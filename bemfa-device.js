module.exports = function(RED) {
    function BemfaDeviceNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        
        node.topic = config.topic;
        node.parseData = config.parseData || false;
        node.datatype = config.datatype || "auto";
        
        // 获取配置节点
        node.bemfaConfig = RED.nodes.getNode(config.bemfa);
        
        if (!node.bemfaConfig) {
            node.error("缺少巴法云配置");
            return;
        }
        
        // 解析小米格式数据 (#温度#湿度#开关#)
        function parseXiaomiFormat(data) {
            if (typeof data !== 'string') return data;
            
            // 小米格式: #温度#湿度#开关#
            if (data.startsWith('#') && data.endsWith('#')) {
                var parts = data.split('#').filter(function(p) { return p !== ''; });
                if (parts.length >= 2) {
                    return {
                        raw: data,
                        values: parts,
                        temp: parts[0],
                        hum: parts[1],
                        state: parts[2] || null
                    };
                }
            }
            return data;
        }
        
        // 解析 JSON 数据
        function parseJsonData(data) {
            try {
                return JSON.parse(data);
            } catch (e) {
                return data;
            }
        }
        
        // 订阅主题
        node.bemfaConfig.subscribe(node.topic, function(message, topic) {
            var payload = message;
            
            if (node.parseData) {
                switch (node.datatype) {
                    case 'json':
                        payload = parseJsonData(message);
                        break;
                    case 'xiaomi':
                        payload = parseXiaomiFormat(message);
                        break;
                    case 'auto':
                        // 自动检测格式
                        if (message.startsWith('#')) {
                            payload = parseXiaomiFormat(message);
                        } else if (message.startsWith('{') || message.startsWith('[')) {
                            payload = parseJsonData(message);
                        }
                        break;
                }
            }
            
            var msg = {
                topic: topic,
                payload: payload,
                raw: message
            };
            
            node.send(msg);
        });
        
        node.status({ fill: "green", shape: "dot", text: "已订阅: " + node.topic });
        
        node.on('close', function() {
            node.status({});
        });
    }
    
    RED.nodes.registerType("bemfa-device", BemfaDeviceNode);
};
