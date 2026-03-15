const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const https = require('https');
const http = require('http');
const axios = require('axios');
const cheerio = require('cheerio');
const NodeMediaServer = require('node-media-server');
const ffmpeg = require('fluent-ffmpeg');

const app = express();
const HTTP_PORT = 8000;
const RTMP_PORT = 1935;
const HTTP_FLV_PORT = 8001;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const uploadDir = path.join(__dirname, 'uploads');
const coursesDir = path.join(__dirname, 'courses');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(coursesDir)) fs.mkdirSync(coursesDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 500 * 1024 * 1024 }
});

let localVideos = [];
let courses = [];

try {
  if (fs.existsSync(path.join(__dirname, 'local-videos.json'))) {
    localVideos = JSON.parse(fs.readFileSync(path.join(__dirname, 'local-videos.json'), 'utf8'));
  }
  if (fs.existsSync(path.join(__dirname, 'courses.json'))) {
    courses = JSON.parse(fs.readFileSync(path.join(__dirname, 'courses.json'), 'utf8'));
  }
} catch(e) {
  console.log('加载数据失败:', e.message);
}

function saveData() {
  fs.writeFileSync(path.join(__dirname, 'local-videos.json'), JSON.stringify(localVideos, null, 2));
  fs.writeFileSync(path.join(__dirname, 'courses.json'), JSON.stringify(courses, null, 2));
}

const demoCourses = [
  {
    id: 1001,
    title: 'React 18 从入门到精通',
    description: '系统学习 React 18 最新特性，Hooks、Suspense、并发模式',
    instructor: '张老师',
    thumbnail: 'https://picsum.photos/seed/react/640/360',
    price: 99,
    category: '前端开发',
    lessons: [
      { id: 1, title: 'React 基础介绍', duration: '15:30', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4' },
      { id: 2, title: 'JSX 语法详解', duration: '20:45', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4' },
      { id: 3, title: '组件与 Props', duration: '25:10', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4' },
      { id: 4, title: 'State 与生命周期', duration: '30:00', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4' },
      { id: 5, title: 'Hooks 深入理解', duration: '40:20', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4' }
    ]
  },
  {
    id: 1002,
    title: 'Node.js 全栈开发实战',
    description: '从 Express 到 MongoDB，完整的后端开发课程',
    instructor: '李老师',
    thumbnail: 'https://picsum.photos/seed/nodejs/640/360',
    price: 199,
    category: '后端开发',
    lessons: [
      { id: 1, title: 'Node.js 环境搭建', duration: '18:00', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4' },
      { id: 2, title: 'Express 框架入门', duration: '25:30', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4' },
      { id: 3, title: 'RESTful API 设计', duration: '35:45', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4' },
      { id: 4, title: 'MongoDB 数据库', duration: '42:15', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4' }
    ]
  },
  {
    id: 1003,
    title: 'Python 数据分析与可视化',
    description: 'Pandas、NumPy、Matplotlib 实战教程',
    instructor: '王老师',
    thumbnail: 'https://picsum.photos/seed/python/640/360',
    price: 149,
    category: '数据分析',
    lessons: [
      { id: 1, title: 'Python 基础回顾', duration: '20:00', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4' },
      { id: 2, title: 'NumPy 数组操作', duration: '28:30', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4' },
      { id: 3, title: 'Pandas 数据处理', duration: '45:00', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4' },
      { id: 4, title: 'Matplotlib 可视化', duration: '38:15', videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4' }
    ]
  }
];

if (courses.length === 0) {
  courses = demoCourses;
  saveData();
}

const videos = [
  {
    id: 1,
    title: '🚀 太空探索直播：国际空间站',
    thumbnail: 'https://picsum.photos/seed/space/640/360',
    streamer: '太空探险家',
    viewers: 12543,
    isLive: true,
    streamKey: 'live-stream-1',
    price: 0,
    category: '科技'
  },
  {
    id: 2,
    title: '🎮 游戏实况：最新大作首发',
    thumbnail: 'https://picsum.photos/seed/gaming/640/360',
    streamer: '游戏达人',
    viewers: 8921,
    isLive: true,
    streamKey: 'live-stream-2',
    price: 9.9,
    category: '游戏'
  },
  {
    id: 3,
    title: '🎵 音乐现场：独立乐队演出',
    thumbnail: 'https://picsum.photos/seed/music/640/360',
    streamer: '音乐频道',
    viewers: 5632,
    isLive: false,
    streamKey: 'live-stream-3',
    price: 0,
    category: '音乐'
  }
];

const comments = {
  1: [
    { user: '小明', text: '太震撼了！', time: '2分钟前', avatar: '👨' },
    { user: '星空爱好者', text: '第一次看到这么清晰的画面', time: '5分钟前', avatar: '🧑' },
    { user: '航天迷', text: '主播辛苦了！', time: '8分钟前', avatar: '👩' }
  ],
  2: [
    { user: '玩家一号', text: '这操作太秀了！', time: '1分钟前', avatar: '🎮' },
    { user: '游戏新手', text: '求带飞~', time: '3分钟前', avatar: '🕹️' }
  ]
};

let activeStreams = new Set();
let purchasedVideos = new Set();
let purchasedCourses = new Set();

const nmsConfig = {
  rtmp: { port: RTMP_PORT, chunk_size: 60000, gop_cache: true, ping: 30, ping_timeout: 60 },
  http: { port: HTTP_FLV_PORT, mediaroot: './media', allow_origin: '*' }
};

try {
  const nms = new NodeMediaServer(nmsConfig);
  nms.on('prePublish', (id, StreamPath, args) => {
    const streamKey = StreamPath.split('/').pop();
    console.log(`[直播开始] streamKey: ${streamKey}`);
    activeStreams.add(streamKey);
  });
  nms.on('donePublish', (id, StreamPath, args) => {
    const streamKey = StreamPath.split('/').pop();
    console.log(`[直播结束] streamKey: ${streamKey}`);
    activeStreams.delete(streamKey);
  });
  nms.run();
} catch(e) {
  console.log('RTMP 服务器启动跳过:', e.message);
}

app.use('/uploads', express.static(uploadDir));
app.use('/courses', express.static(coursesDir));

app.get('/api/videos', (req, res) => {
  const videosWithStatus = videos.map(v => ({
    ...v, isStreaming: activeStreams.has(v.streamKey)
  }));
  res.json([...localVideos, ...videosWithStatus]);
});

app.get('/api/courses', (req, res) => {
  res.json(courses.map(c => ({
    ...c,
    isPurchased: purchasedCourses.has(c.id),
    lessons: c.lessons?.map(l => ({
      ...l,
      videoUrl: purchasedCourses.has(c.id) ? l.videoUrl : null
    }))
  })));
});

app.get('/api/courses/:id', (req, res) => {
  const course = courses.find(c => c.id === parseInt(req.params.id));
  if (!course) return res.status(404).json({ error: 'Course not found' });
  res.json({
    ...course,
    isPurchased: purchasedCourses.has(course.id),
    lessons: purchasedCourses.has(course.id) ? course.lessons : course.lessons.map(l => ({ ...l, videoUrl: null }))
  });
});

app.post('/api/courses/:id/purchase', (req, res) => {
  const courseId = parseInt(req.params.id);
  purchasedCourses.add(courseId);
  res.json({ success: true, message: '购买成功！' });
});

app.get('/api/videos/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const localVideo = localVideos.find(v => v.id === id);
  if (localVideo) return res.json(localVideo);
  const video = videos.find(v => v.id === id);
  if (!video) return res.status(404).json({ error: 'Video not found' });
  res.json({ ...video, isStreaming: activeStreams.has(video.streamKey) });
});

app.get('/api/videos/:id/comments', (req, res) => {
  res.json(comments[req.params.id] || []);
});

app.post('/api/videos/:id/comments', (req, res) => {
  const videoId = req.params.id;
  if (!comments[videoId]) comments[videoId] = [];
  comments[videoId].unshift({
    user: req.body.user || '匿名用户',
    text: req.body.text,
    time: '刚刚',
    avatar: '😊'
  });
  res.json({ success: true });
});

app.post('/api/purchase/:id', (req, res) => {
  const videoId = parseInt(req.params.id);
  purchasedVideos.add(videoId);
  res.json({ success: true, message: '购买成功！' });
});

app.get('/api/purchased', (req, res) => {
  res.json(Array.from(purchasedVideos));
});

app.get('/api/streams', (req, res) => {
  res.json({ 
    active: Array.from(activeStreams),
    rtmpUrl: `rtmp://49.234.52.249:${RTMP_PORT}/live/`,
    httpFlvUrl: `http://49.234.52.249:${HTTP_FLV_PORT}/live/`
  });
});

app.post('/api/upload', upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '没有上传文件' });
  
  const originalPath = req.file.path;
  const videoId = Date.now();
  const compressedFilename = videoId + '-compressed.mp4';
  const compressedPath = path.join(uploadDir, compressedFilename);
  
  console.log(`[上传] 开始处理视频: ${req.file.originalname}, 大小: ${(req.file.size / 1024 / 1024).toFixed(2)}MB`);
  
  ffmpeg(originalPath)
    .output(compressedPath)
    .videoCodec('libx264')
    .audioCodec('aac')
    .size('?x720')
    .videoBitrate('1000k')
    .audioBitrate('128k')
    .outputOptions(['-movflags', '+faststart', '-crf', '28'])
    .on('start', (commandLine) => {
      console.log('[FFmpeg] 开始压缩: ' + commandLine);
    })
    .on('progress', (progress) => {
      console.log('[FFmpeg] 处理中: ' + Math.round(progress.percent || 0) + '%');
    })
    .on('end', () => {
      console.log('[FFmpeg] 压缩完成！');
      
      try {
        fs.unlinkSync(originalPath);
        console.log('[上传] 已删除原始文件');
      } catch (e) {
        console.log('[上传] 删除原始文件失败:', e.message);
      }
      
      const newVideo = {
        id: videoId,
        title: req.body.title || req.file.originalname,
        thumbnail: 'https://picsum.photos/seed/' + videoId + '/640/360',
        streamer: '本地用户',
        viewers: 0,
        isLive: false,
        isLocal: true,
        videoUrl: '/uploads/' + compressedFilename,
        price: 0,
        category: '本地'
      };
      localVideos.unshift(newVideo);
      saveData();
      res.json({ success: true, video: newVideo });
    })
    .on('error', (err) => {
      console.log('[FFmpeg] 压缩失败:', err.message);
      console.log('[上传] 使用原始文件代替');
      
      const newVideo = {
        id: videoId,
        title: req.body.title || req.file.originalname,
        thumbnail: 'https://picsum.photos/seed/' + videoId + '/640/360',
        streamer: '本地用户',
        viewers: 0,
        isLive: false,
        isLocal: true,
        videoUrl: '/uploads/' + req.file.filename,
        price: 0,
        category: '本地'
      };
      localVideos.unshift(newVideo);
      saveData();
      res.json({ success: true, video: newVideo });
    })
    .run();
});

async function downloadVideo(url, filename) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const filePath = path.join(coursesDir, filename);
    
    client.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadVideo(response.headers.location, filename).then(resolve).catch(reject);
      }
      
      const fileStream = fs.createWriteStream(filePath);
      response.pipe(fileStream);
      
      fileStream.on('finish', () => {
        resolve('/courses/' + filename);
      });
    }).on('error', reject);
  });
}

app.post('/api/crawl', async (req, res) => {
  const { url, title, type = 'video' } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: '请提供视频URL' });
  }
  
  const videoId = Date.now();
  const filename = videoId + '.mp4';
  
  try {
    const videoPath = await downloadVideo(url, filename);
    const newVideo = {
      id: videoId,
      title: title || '爬取的视频',
      thumbnail: 'https://picsum.photos/seed/' + videoId + '/640/360',
      streamer: '爬虫',
      viewers: 0,
      isLive: false,
      isLocal: true,
      videoUrl: videoPath,
      price: 0,
      category: '爬虫'
    };
    
    localVideos.unshift(newVideo);
    saveData();
    res.json({ success: true, video: newVideo });
  } catch (e) {
    const newVideo = {
      id: videoId,
      title: title || '演示视频',
      thumbnail: 'https://picsum.photos/seed/' + videoId + '/640/360',
      streamer: '演示',
      viewers: 0,
      isLive: false,
      isLocal: true,
      videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
      price: 0,
      category: '演示'
    };
    localVideos.unshift(newVideo);
    saveData();
    res.json({ 
      success: true, 
      message: '演示模式：使用示例视频',
      video: newVideo 
    });
  }
});

app.post('/api/courses/add', (req, res) => {
  const { title, description, instructor, price, category, lessons } = req.body;
  const newCourse = {
    id: Date.now(),
    title, description, instructor,
    thumbnail: 'https://picsum.photos/seed/' + Date.now() + '/640/360',
    price: price || 0,
    category: category || '其他',
    lessons: lessons || []
  };
  courses.unshift(newCourse);
  saveData();
  res.json({ success: true, course: newCourse });
});

let chatHistory = [];
const { exec } = require('child_process');

const audioDir = path.join(__dirname, 'audio');
if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });

app.use('/audio', express.static(audioDir));

app.get('/api/chat/history', (req, res) => {
  res.json(chatHistory.slice(-50));
});

app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: '请输入消息' });
  
  chatHistory.push({ role: 'user', content: message, timestamp: Date.now() });
  
  try {
    const response = await fetch('http://localhost:8080/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    
    let aiMessage = '抱歉，我现在无法回复。请直接在 OpenClaw 中与我对话。';
    
    if (response.ok) {
      const data = await response.json();
      aiMessage = data.message || aiMessage;
    }
    
    chatHistory.push({ role: 'assistant', content: aiMessage, timestamp: Date.now() });
    res.json({ success: true, message: aiMessage });
  } catch (e) {
    const fallbackMessage = '你好！我是你的 AI 助手。目前聊天功能需要在 OpenClaw 界面中使用，但我可以帮你：\n\n1. 🎬 管理视频和直播\n2. 📚 浏览课程\n3. 📤 上传和下载视频\n4. 📡 设置推流\n\n有什么需要帮助的吗？';
    chatHistory.push({ role: 'assistant', content: fallbackMessage, timestamp: Date.now() });
    res.json({ success: true, message: fallbackMessage });
  }
});

app.post('/api/tts', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: '请输入文本' });
  
  const audioId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  const audioPath = path.join(audioDir, audioId + '.wav');
  
  try {
    const ttsResult = await new Promise((resolve, reject) => {
      exec('echo "TTS is handled by OpenClaw assistant directly"', (error, stdout, stderr) => {
        if (error) reject(error);
        else resolve(stdout);
      });
    });
    
    res.json({ 
      success: true, 
      message: '语音合成需要在 OpenClaw 界面中使用',
      note: '我可以直接在对话中用语音回复你！请在 OpenClaw 中与我对话。'
    });
  } catch (e) {
    res.json({ 
      success: true, 
      message: '语音功能提示',
      note: '你可以直接在 OpenClaw 中让我用语音回复！我支持多种声音和语言。'
    });
  }
});

app.post('/api/crawler/parse', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: '请输入网址' });
  
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 30000
    });
    
    const $ = cheerio.load(response.data);
    const videos = [];
    const pageTitle = $('title').text() || url;
    
    $('video').each((i, el) => {
      const src = $(el).attr('src') || $(el).find('source').attr('src');
      if (src) {
        videos.push({
          type: 'video-tag',
          url: src.startsWith('http') ? src : new URL(src, url).href,
          poster: $(el).attr('poster')
        });
      }
    });
    
    $('iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="bilibili"]').each((i, el) => {
      videos.push({
        type: 'iframe',
        url: $(el).attr('src')
      });
    });
    
    $('a[href$=".mp4"], a[href$=".webm"], a[href$=".mov"]').each((i, el) => {
      const href = $(el).attr('href');
      if (href) {
        videos.push({
          type: 'link',
          url: href.startsWith('http') ? href : new URL(href, url).href,
          text: $(el).text()
        });
      }
    });
    
    const videoPatterns = [
      /['"](https?:\/\/[^'"<>]+\.(mp4|webm|mov|m3u8)[^'"<>]*)['"]/gi,
      /(?:src|href|url)\s*[=:]\s*['"]?([^'"<>]+\.(mp4|webm|mov|m3u8)[^'"<>]*)['"]?/gi
    ];
    
    videoPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(response.data)) !== null) {
        const videoUrl = match[1];
        if (!videos.some(v => v.url === videoUrl)) {
          videos.push({
            type: 'extracted',
            url: videoUrl.startsWith('http') ? videoUrl : new URL(videoUrl, url).href
          });
        }
      }
    });
    
    res.json({
      success: true,
      title: pageTitle,
      url: url,
      videos: videos,
      total: videos.length
    });
    
  } catch (error) {
    res.status(500).json({
      error: '解析失败',
      message: error.message,
      note: '可能需要登录或网站有反爬机制'
    });
  }
});

app.post('/api/crawler/download', async (req, res) => {
  const { url, title } = req.body;
  if (!url) return res.status(400).json({ error: '请输入视频URL' });
  
  const videoId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  const videoExt = path.extname(new URL(url).pathname) || '.mp4';
  const videoPath = path.join(uploadDir, videoId + videoExt);
  
  try {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 60000
    });
    
    const writer = fs.createWriteStream(videoPath);
    response.data.pipe(writer);
    
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    
    const newVideo = {
      id: Date.now(),
      title: title || '下载的视频 ' + videoId,
      streamer: '网络爬虫',
      category: '下载',
      thumbnail: 'https://picsum.photos/seed/' + videoId + '/640/360',
      viewers: 1,
      isLive: false,
      isStreaming: false,
      isLocal: true,
      streamKey: 'download-' + videoId,
      price: 0,
      videoUrl: '/uploads/' + videoId + videoExt
    };
    
    videos.unshift(newVideo);
    saveData();
    
    res.json({
      success: true,
      message: '视频下载成功！',
      video: newVideo
    });
    
  } catch (error) {
    if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
    res.status(500).json({
      error: '下载失败',
      message: error.message
    });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log(`🚀 视频网站已启动！`);
  console.log(`📺 网站地址: http://49.234.52.249:${HTTP_PORT}`);
  console.log(``);
  console.log(`🎥 推流配置：`);
  console.log(`   RTMP 地址: rtmp://49.234.52.249:${RTMP_PORT}/live/`);
  console.log(`   Stream Keys: live-stream-1, live-stream-2, live-stream-3`);
  console.log(``);
  console.log(`📚 新增功能：`);
  console.log(`   - 慕课风格课程系统`);
  console.log(`   - 演示课程已预置`);
  console.log(`   - 通用视频爬虫`);
  console.log(``);
  console.log(`🎯 重要：去腾讯云控制台打开端口 1935, 8000, 8001！`);
});
