#!/usr/bin/env bash
# 把 3080 上的 dsh web 换成新进程（插件改了代码之后跑一次）。
# 关键点：systemd-run 的 PATH 里没有 ~/.npm-global/bin，所以必须用绝对路径。
set -u
DSH_BIN=$HOME/.npm-global/bin/dsh
LOG=$HOME/.dsh/logs/dsh-web-restart.log
URLFILE=$HOME/.dsh/logs/dsh-web-url.txt
mkdir -p "$(dirname "$LOG")"
exec >> "$LOG" 2>&1
echo "---- $(date '+%F %T') 重启 dsh web ----"
if [ ! -x "$DSH_BIN" ]; then echo "找不到 dsh：$DSH_BIN"; exit 1; fi
OLD=$(pgrep -f "node .*dsh web" | head -1)
echo "旧进程: $OLD"
if [ -n "$OLD" ]; then
  kill -TERM "$OLD" 2>/dev/null
  for i in $(seq 1 20); do kill -0 "$OLD" 2>/dev/null || break; sleep 1; done
  kill -0 "$OLD" 2>/dev/null && kill -9 "$OLD" 2>/dev/null
fi
sleep 2
systemctl --user stop dsh-web 2>/dev/null
systemctl --user reset-failed dsh-web 2>/dev/null
systemd-run --user --unit=dsh-web --working-directory=/home/david \
  --setenv=HOME=/home/david --setenv=PATH=/home/david/.npm-global/bin:/usr/local/bin:/usr/bin:/bin \
  "$DSH_BIN" web --no-open
for i in $(seq 1 45); do
  ss -lnt 2>/dev/null | grep -q ":3080" && break
  sleep 1
done
if ss -lnt 2>/dev/null | grep -q ":3080"; then
  sleep 3
  URL=$(journalctl --user -u dsh-web --no-pager -n 300 2>/dev/null | grep -o "http://127.0.0.1:3080/?token=[A-Za-z0-9_-]*" | tail -1)
  echo "$URL" > "$URLFILE"
  echo "重启成功：$URL"
else
  echo "重启失败"; systemctl --user status dsh-web --no-pager 2>&1 | tail -12
fi