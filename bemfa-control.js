module.exports = function(RED) {
    const http = require('http');
    
    function BemfaControlNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        
        node.topic = config.topic;
        node.command = config.command || "";
        node.useMsgPayload = config.useMsgPayload !== false;
        node.useHttpApi = config.useHttpApi || false;
        node.deviceType = config.deviceType || "3";
        
        // 获取配置节点
        node.bemfaConfig = RED.nodes.getNode(config.bemfa);
        
        if (!node.bemfaConfig) {
            node.error("缺少巴法云配置");
            return;
        }
        
        // HTTP API 发送控制命令
        node.sendHttpControl = function(topic, message, callback) {
            const uid = node.bemfaConfig.credentials.uid;
            const type = parseInt(node.deviceType);
            
            const postData = JSON.stringify({
                uid: uid,
                topic: topic,
                type: type,
                msg: String(message)
            });
            
            const options = {
                hostname: 'apis.bemfa.com',
                port: 80,
                path: '/va/postJsonMsg',
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
        
        node.on('input', function(msg) {
            var topic = msg.topic || node.topic;
            var message;
            
            if (!topic) {
                node.error("缺少主题");
                return;
            }
            
            // 确定要发送的消息
            if (node.useMsgPayload && msg.payload !== undefined) {
                // 使用输入消息的 payload
                if (typeof msg.payload === 'object') {
                    message = JSON.stringify(msg.payload);
                } else {
                    message = String(msg.payload);
                }
            } else if (node.command) {
                // 使用配置的命令
                message = node.command;
            } else {
                node.error("没有可发送的消息");
                return;
            }
            
            if (node.useHttpApi || msg.useHttpApi) {
                // 使用 HTTP API 发送
                node.sendHttpControl(topic, message, (err, result) => {
                    if (err) {
                        node.error('HTTP 控制失败: ' + err.message);
                        node.status({ fill: "red", shape: "ring", text: "HTTP 失败" });
                    } else {
                        node.send({
                            topic: topic,
                            payload: message,
                            result: result,
                            success: result && result.code === 0
                        });
                        node.status({ fill: "green", shape: "dot", text: "HTTP 已发送" });
                    }
                    setTimeout(function() {
                        node.status({});
                    }, 2000);
                });
            } else {
                // 使用 MQTT 发布消息
                node.bemfaConfig.publish(topic, message);
                
                // 发送确认消息
                node.send({
                    topic: topic,
                    payload: message,
                    success: true
                });
                
                node.status({ fill: "green", shape: "dot", text: "MQTT 已发送: " + message });
                setTimeout(function() {
                    node.status({});
                }, 2000);
            }
        });
    }
    
    RED.nodes.registerType("bemfa-control", BemfaControlNode);
};
