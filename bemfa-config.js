module.exports = function(RED) {
    function BemfaConfigNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        
        node.uid = config.uid;
        node.broker = config.broker || 'bemfa.com';
        node.port = config.port || 9501;
        
        // MQTT 客户端
        node.client = null;
        node.subscriptions = {};
        
        node.connect = function() {
            if (node.client && node.client.connected) {
                return node.client;
            }
            
            var mqtt = require('mqtt');
            var brokerUrl = `mqtt://${node.broker}:${node.port}`;
            
            node.client = mqtt.connect(brokerUrl, {
                clientId: node.uid,
                keepalive: 60,
                reconnectPeriod: 5000,
                connectTimeout: 30000
            });
            
            node.client.on('connect', function() {
                node.log('已连接到巴法云: ' + brokerUrl);
                
                // 重新订阅之前的主题
                Object.keys(node.subscriptions).forEach(function(topic) {
                    node.client.subscribe(topic, function(err) {
                        if (err) {
                            node.error('订阅失败: ' + topic, err);
                        } else {
                            node.log('已订阅: ' + topic);
                        }
                    });
                });
            });
            
            node.client.on('error', function(err) {
                node.error('连接错误: ' + err.message);
            });
            
            node.client.on('offline', function() {
                node.warn('巴法云连接离线');
            });
            
            return node.client;
        };
        
        node.subscribe = function(topic, callback) {
            node.subscriptions[topic] = callback;
            
            if (node.client && node.client.connected) {
                node.client.subscribe(topic, function(err) {
                    if (err) {
                        node.error('订阅失败: ' + topic, err);
                    }
                });
            }
            
            node.client.on('message', function(receivedTopic, message) {
                if (receivedTopic === topic && node.subscriptions[topic]) {
                    node.subscriptions[topic](message.toString(), receivedTopic);
                }
            });
        };
        
        node.publish = function(topic, message) {
            if (node.client && node.client.connected) {
                node.client.publish(topic, message, function(err) {
                    if (err) {
                        node.error('发布失败: ' + err.message);
                    }
                });
            } else {
                node.error('MQTT 未连接，无法发布消息');
            }
        };
        
        node.on('close', function() {
            if (node.client) {
                node.client.end();
            }
        });
        
        // 立即连接
        node.connect();
    }
    
    RED.nodes.registerType("bemfa-config", BemfaConfigNode, {
        credentials: {
            uid: { type: "text" }
        }
    });
};
