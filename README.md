# node-red-contrib-bemfa

巴法云物联网平台 Node-RED 自定义节点，无需 Home Assistant，直接在 Node-RED 中实现设备订阅、控制和自动化。

## 功能特性

- ** bemfa-config **：配置巴法云连接参数（私钥、服务器等）
- ** bemfa-device **：订阅设备消息，支持自动解析数据格式
- ** bemfa-control **：向设备发送控制命令

## 安装

```bash
# 方式 1：本地安装
cd ~/.node-red
npm install /path/to/node-red-contrib-bemfa

# 方式 2：npm 安装（发布后）
npm install node-red-contrib-bemfa
```

重启 Node-RED 后，在左侧节点栏的"巴法云"分类中可以看到节点。

## 使用说明

### 1. 配置巴法云连接

1. 从左侧拖出任意巴法云节点
2. 双击节点，点击"配置"右侧的编辑按钮
3. 输入从[巴法云控制台](https://cloud.bemfa.com/tcp/index.html)获取的私钥 UID
4. 保存配置

### 2. 订阅设备消息（bemfa-device）

- 配置主题（如 `led002`）
- 选择是否自动解析数据格式
- 支持解析：
  - **JSON 格式**：自动解析为对象
  - **小米格式**：解析 `#温度#湿度#开关#` 格式
  - **纯文本**：保持原样输出

### 3. 发送控制命令（bemfa-control）

**方式 1：固定命令**
- 在节点中配置固定命令（如 `on` / `off`）
- 连接 inject 节点触发

**方式 2：动态命令**
- 勾选"使用输入消息的 payload"
- 上游节点的 payload 将作为命令发送

## 自动化示例

### 温度自动开空调

```
[bemfa-device: 温度传感器]
  ├── 主题: temp004
  ├── 解析格式: 小米格式
  └── 输出: {temp: "28.5", hum: "65"}
        ↓
    [function 节点]
      if (msg.payload.temp > 28) {
        return {payload: "on"};
      }
        ↓
[bemfa-control: 空调]
  └── 主题: ac005
```

### 定时开关灯

```
[inject 节点]
  ├── 重复: 每天 20:00
  └── payload: "on"
        ↓
[bemfa-control: 客厅灯]
  └── 主题: light002
```

## 数据格式说明

### 小米格式解析

输入：`#25.5#60#on#`

输出：
```json
{
  "raw": "#25.5#60#on#",
  "temp": "25.5",
  "hum": "60",
  "state": "on"
}
```

## 主题命名规则

巴法云通过主题后缀识别设备类型：

| 后缀 | 设备类型 | 示例 |
|------|----------|------|
| 001 | 插座 | `socket001` |
| 002 | 灯泡 | `led002` |
| 003 | 风扇 | `fan003` |
| 004 | 传感器 | `temp004` |
| 005 | 空调 | `ac005` |
| 006 | 开关 | `switch006` |
| 009 | 窗帘 | `curtain009` |

## 节点输出格式

### bemfa-device 输出

```json
{
  "topic": "led002",
  "payload": "on",
  "raw": "on"
}
```

或解析后：

```json
{
  "topic": "temp004",
  "payload": {
    "temp": "25.5",
    "hum": "60"
  },
  "raw": "#25.5#60#"
}
```

### bemfa-control 输出

```json
{
  "topic": "led002",
  "payload": "on",
  "success": true
}
```

## 故障排除

### 节点显示"未连接"
- 检查私钥 UID 是否正确
- 检查网络连接
- 查看 Node-RED 日志

### 无法接收消息
- 确认主题已在巴法云控制台创建
- 检查是否有其他客户端订阅同一主题
- 确认设备确实在发送消息

### 无法发送控制命令
- 确认主题正确
- 检查命令格式是否符合设备要求
- 确认设备在线

## 依赖

- Node-RED >= 2.0.0
- Node.js >= 14.0.0
- mqtt ^5.0.3

## 许可证

MIT

## 相关链接

- [巴法云官网](https://cloud.bemfa.com)
- [巴法云文档](https://cloud.bemfa.com/docs/)
- [Node-RED 官网](https://nodered.org)
