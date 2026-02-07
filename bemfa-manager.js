module.exports = function(RED) {
    const http = require('http');
    const https = require('https');
    
    function BemfaManagerNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        // 获取配置
        node.bemfaConfig = RED.nodes.getNode(config.bemfa);
        node.refreshInterval = parseInt(config.refreshInterval) || 300;
        node.autoSubscribe = config.autoSubscribe !== false;
        node.outputDeviceInfo = config.outputDeviceInfo !== false;
        
        if (!node.bemfaConfig) {
            node.error("缺少巴法云配置");
            return;
        }
        
        node.devices = {}; // 存储设备信息
        node.refreshTimer = null;
        
        // HTTP API 基础配置
        const API_BASE = 'apis.bemfa.com';
        const API_DEVICE_LIST = '/vb/api/v2/allTopic';
        const API_CONTROL = '/va/postJsonMsg';
        
        // 获取设备列表
        node.fetchDevices = function(callback) {
            const uid = node.bemfaConfig.credentials.uid;
            const url = `http://${API_BASE}${API_DEVICE_LIST}?openID=${uid}&type=3`;
            
            http.get(url, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        if (result.code === 0 && result.data) {
                            node.devices = {};
                            result.data.forEach(device => {
                                node.devices[device.topic] = {
                                    topic: device.topic,
                                    name: device.name || device.topic,
                                    type: device.deviceType || 'unknown',
                                    online: device.online,
                                    msg: device.msg,
                                    time: device.time,
                                    lastUpdate: Date.now()
                                };
                            });
                            node.log(`获取到 ${Object.keys(node.devices).length} 个设备`);
                            if (callback) callback(null, node.devices);
                        } else {
                            if (callback) callback(new Error('API返回错误'));
                        }
                    } catch (e) {
                        node.error('解析设备列表失败: ' + e.message);
                        if (callback) callback(e);
                    }
                });
            }).on('error', (err) => {
                node.error('获取设备列表失败: ' + err.message);
                if (callback) callback(err);
            });
        };
        
        // 订阅所有主题
        node.subscribeAll = function() {
            if (!node.autoSubscribe) return;
            
            Object.keys(node.devices).forEach(topic => {
                node.bemfaConfig.subscribe(topic, (message, receivedTopic) => {
                    const device = node.devices[receivedTopic];
                    let payload = message;
                    
                    // 尝试解析数据
                    try {
                        if (message.startsWith('#')) {
                            // 小米格式
                            const parts = message.split('#').filter(p => p);
                            payload = {
                                raw: message,
                                values: parts
                            };
                            if (parts.length >= 2) {
                                payload.temp = parts[0];
                                payload.hum = parts[1];
                                payload.state = parts[2] || null;
                            }
                        } else if (message.startsWith('{') || message.startsWith('[')) {
                            // JSON格式
                            payload = JSON.parse(message);
                        }
                    } catch (e) {
                        // 保持原样
                    }
                    
                    // 更新设备状态
                    if (device) {
                        device.msg = message;
                        device.lastUpdate = Date.now();
                    }
                    
                    // 发送消息
                    const msg = {
                        topic: receivedTopic,
                        payload: payload,
                        raw: message,
                        device: node.outputDeviceInfo ? device : undefined
                    };
                    
                    node.send(msg);
                });
            });
            
            node.status({ 
                fill: "green", 
                shape: "dot", 
                text: `已管理 ${Object.keys(node.devices).length} 个设备` 
            });
        };
        
        // 发送控制命令（HTTP API）
        node.controlDevice = function(topic, message, callback) {
            const uid = node.bemfaConfig.credentials.uid;
            const device = node.devices[topic];
            const type = device ? (device.type === 'mqtt' ? 1 : 3) : 3;
            
            const postData = JSON.stringify({
                uid: uid,
                topic: topic,
                type: type,
                msg: String(message)
            });
            
            const options = {
                hostname: 'apis.bemfa.com',
                port: 80,
                path: API_CONTROL,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };
            
            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        if (callback) callback(null, result);
                    } catch (e) {
                        if (callback) callback(e);
                    }
                });
            });
            
            req.on('error', (err) => {
                if (callback) callback(err);
            });
            
            req.write(postData);
            req.end();
        };
        
        // 输入处理（接收控制命令）
        node.on('input', function(msg) {
            if (msg.topic && msg.payload !== undefined) {
                node.controlDevice(msg.topic, msg.payload, (err, result) => {
                    if (err) {
                        node.error('控制失败: ' + err.message);
                    } else {
                        node.send({
                            topic: msg.topic,
                            payload: msg.payload,
                            result: result,
                            success: result && result.code === 0
                        });
                    }
                });
            } else if (msg.refresh === true) {
                // 手动刷新设备列表
                node.fetchDevices((err, devices) => {
                    if (!err) {
                        node.subscribeAll();
                        node.send({
                            topic: 'refresh',
                            payload: devices,
                            count: Object.keys(devices).length
                        });
                    }
                });
            }
        });
        
        // 定期刷新
        node.startRefresh = function() {
            if (node.refreshTimer) {
                clearInterval(node.refreshTimer);
            }
            
            node.refreshTimer = setInterval(() => {
                node.fetchDevices((err) => {
                    if (!err && node.autoSubscribe) {
                        // 检查新设备并订阅
                        node.subscribeAll();
                    }
                });
            }, node.refreshInterval * 1000);
        };
        
        // 初始化
        node.fetchDevices((err) => {
            if (!err) {
                node.subscribeAll();
                node.startRefresh();
            }
        });
        
        node.on('close', function() {
            if (node.refreshTimer) {
                clearInterval(node.refreshTimer);
            }
        });
    }
    
    RED.nodes.registerType("bemfa-manager", BemfaManagerNode);
};
