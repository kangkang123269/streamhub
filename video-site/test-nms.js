const NodeMediaServer = require('node-media-server');
console.log('✅ Node-Media-Server 导入成功');

const config = {
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: 8001,
    mediaroot: './media',
    allow_origin: '*'
  }
};

const nms = new NodeMediaServer(config);
nms.run();
console.log('🚀 RTMP 服务器已启动: rtmp://localhost:1935');
console.log('📺 HTTP-FLV 服务器: http://localhost:8001');
