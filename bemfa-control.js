module.exports = function(RED) {
    function BemfaControlNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        
        node.topic = config.topic;
        node.command = config.command || "";
        node.useMsgPayload = config.useMsgPayload !== false;
        
        // 获取配置节点
        node.bemfaConfig = RED.nodes.getNode(config.bemfa);
        
        if (!node.bemfaConfig) {
            node.error("缺少巴法云配置");
            return;
        }
        
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
            
            // 发布消息
            node.bemfaConfig.publish(topic, message);
            
            // 发送确认消息
            node.send({
                topic: topic,
                payload: message,
                success: true
            });
            
            node.status({ fill: "green", shape: "dot", text: "已发送: " + message });
            setTimeout(function() {
                node.status({});
            }, 2000);
        });
    }
    
    RED.nodes.registerType("bemfa-control", BemfaControlNode);
};
