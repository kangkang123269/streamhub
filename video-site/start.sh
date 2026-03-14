#!/bin/bash
cd /root/.openclaw/workspace/video-site

# 检查是否安装了依赖
if [ ! -d "node_modules" ]; then
    echo "正在安装依赖..."
    npm install express cors
fi

echo "🚀 启动视频网站..."
node server.js
