# AI 发送功能流程文档

## 功能概述

AI 发送功能允许用户将剪切板内容（文本）发送到 AI 接口（OpenAI Responses API）进行处理，并返回 AI 的回复。

## 数据流图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AI 发送功能完整流程                                 │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌──────────────┐
  │  偏好设置页面 │ ◄── 启用/禁用 AI 发送，配置 API 参数
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐     ┌──────────────────┐
  │ clipboardStore│────►│  aiSend: {       │
  │   (valtio)   │     │    enabled       │
  └──────────────┘     │    baseUrl       │
                       │    apiKey        │
                       │    model         │
                       │    customHeaders │
                       │    showInUI      │
                       │  }               │
                       └──────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              主界面历史列表                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐      │
│   │   Item   │─────►│  Header  │─────►│操作按钮UI │─────►│ 点击 send │      │
│   └──────────┘      └──────────┘      └──────────┘      └────┬─────┘      │
│        │                                                     │             │
│        │              ┌──────────────────┐                   │             │
│        └─────────────►│   SendModal (ref) │◄─────────────────┘             │
│                       └────────┬─────────┘                                 │
│                                │                                           │
└────────────────────────────────┼───────────────────────────────────────────┘
                                 ▼
                    ┌──────────────────────┐
                    │    1. open(id)       │
                    │    2. 查找 item      │
                    │    3. 显示模态框      │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   用户点击发送按钮    │
                    │   handleSend(extra)  │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   构建请求数据        │
                    │   {                  │
                    │     input: [         │
                    │       { content, role }  ◄── 剪切板内容
                    │       { content, role }  ◄── 用户补充信息（可选）
                    │     ],
                    │     model            │
                    │   }                  │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │  POST /v1/responses  │
                    │  Authorization: Bearer
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │  解析响应            │
                    │  output[0].content[0].text
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │  显示成功/失败提示    │
                    └──────────────────────┘
```

## 核心组件说明

### 1. 配置存储

**文件**: `src/stores/clipboard.ts`

```typescript
export const clipboardStore = proxy<ClipboardStore>({
  aiSend: {
    apiKey: "",
    baseUrl: "https://api.openai.com",
    customHeaders: {},
    enabled: false,
    model: "gpt-4o",
    showInUI: true,
  },
  // ... 其他配置
});
```

### 2. 类型定义

**文件**: `src/types/store.d.ts`

```typescript
export interface ClipboardStore {
  // AI 发送配置
  aiSend?: {
    enabled: boolean;
    baseUrl: string;
    apiKey: string;
    model: string;
    customHeaders: Record<string, string>;
    showInUI: boolean;
  };
}

export type OperationButton =
  | "copy"
  | "pastePlain"
  | "note"
  | "star"
  | "delete"
  | "send";  // 发送按钮类型
```

### 3. 偏好设置页面

**文件**:
- `src/pages/Preference/components/AiSend/index.tsx` - 主入口
- `src/pages/Preference/components/AiSend/components/ApiSettings/index.tsx` - API 配置

**功能**:
- 总开关控制 `enabled` 状态
- 配置 `baseUrl` (默认: https://api.openai.com)
- 配置 `apiKey`
- 配置 `model` (默认: gpt-4o)
- 配置 `customHeaders` (JSON 格式自定义请求头)

### 4. 操作按钮配置

**文件**: `src/pages/Preference/components/Clipboard/components/OperationButton/index.tsx`

```typescript
export const transferData: TransferData[] = [
  // ... 其他按钮
  {
    icon: "i-lucide:send",
    key: "send",
    title: "preference.clipboard.content_settings.label.operation_button_option.send",
  },
  // ... 其他按钮
];
```

**说明**:
- 发送按钮使用 `i-lucide:send` 图标
- 可以在偏好设置中自定义显示哪些按钮及排序
- 默认操作按钮顺序: `["copy", "send", "star", "delete"]`

### 5. 历史列表 (HistoryList)

**文件**: `src/pages/Main/components/HistoryList/index.tsx`

```typescript
const sendModalRef = useRef<SendModalRef>(null);

// 渲染 Item 时传递 handleSend 回调
<Item
  data={data}
  handleSend={() => sendModalRef.current?.open(data.id)}
  // ... 其他 props
/>

// 渲染 SendModal
<SendModal ref={sendModalRef} />
```

### 6. 条目组件 (Item)

**文件**: `src/pages/Main/components/HistoryList/components/Item/index.tsx`

```typescript
export interface ItemProps {
  data: DatabaseSchemaHistory;
  handleSend: () => void;  // 从 HistoryList 接收
  // ... 其他 props
}

// 传递给 Header 组件
<Header
  data={data}
  handleSend={handleSend}
  // ... 其他 props
/>

// 也传递给右键菜单
const { handleContextMenu, ...rest } = useContextMenu({
  ...props,
  handleSend,
});
```

### 7. 头部组件 (Header)

**文件**: `src/pages/Main/components/HistoryList/components/Header/index.tsx`

```typescript
const handleClick = (event: MouseEvent, key: OperationButton) => {
  switch (key) {
    // ... 其他 case
    case "send":
      return handleSend();  // 触发发送
    // ... 其他 case
  }
};

// 渲染操作按钮
{operationButtons.map((item) => (
  <UnoIcon
    key={key}
    name={icon}
    onClick={(event) => handleClick(event, key)}
    title={t(title)}
  />
))}
```

### 8. 发送模态框 (SendModal)

**文件**: `src/pages/Main/components/HistoryList/components/SendModal/index.tsx`

**核心逻辑**:

```typescript
export interface SendModalRef {
  open: (id: string) => void;  // 暴露给父组件的方法
}

const handleSend = async (extraMessage?: string) => {
  if (!item || !aiSend?.enabled) return;

  // 构建消息数组
  const messages = [
    {
      content: item.value,  // 剪切板内容
      role: "user",
    },
  ];

  if (extraMessage) {
    messages.push({
      content: extraMessage,  // 用户补充信息
      role: "user",
    });
  }

  // 调用 OpenAI Responses API
  const response = await fetch(`${aiSend.baseUrl}/v1/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${aiSend.apiKey}`,
      "Content-Type": "application/json",
      ...aiSend.customHeaders,
    },
    body: JSON.stringify({
      input: messages,
      model: aiSend.model || "gpt-4o",
    }),
  });

  // 解析响应
  const data = await response.json();
  const result = data.output?.[0]?.content?.[0]?.text || "发送成功";
};
```

**界面**:
- 模态框标题: "发送"
- 输入框: 补充信息（可选）
- 按钮: 取消、直接发送

## API 接口说明

### 请求

```http
POST /v1/responses
Content-Type: application/json
Authorization: Bearer {apiKey}

{
  "input": [
    {
      "content": "剪切板内容",
      "role": "user"
    },
    {
      "content": "用户补充信息（可选）",
      "role": "user"
    }
  ],
  "model": "gpt-4o"
}
```

### 响应

```json
{
  "output": [
    {
      "content": [
        {
          "text": "AI 回复内容"
        }
      ]
    }
  ]
}
```

## 国际化键值

**中文** (`src/locales/zh-CN.json`):
```json
{
  "component.send_modal": {
    "button": {
      "cancel": "取消",
      "direct_send": "直接发送"
    },
    "hints": {
      "input_extra_message": "请输入补充信息（可选）"
    },
    "label": {
      "send": "发送"
    }
  },
  "preference.ai_send.settings": {
    "title": "AI 发送设置",
    "label.enable": "启用 AI 发送",
    "label.base_url": "API 地址",
    "label.api_key": "API Key",
    "label.model": "模型",
    "label.custom_headers": "自定义请求头"
  }
}
```

## 注意事项

1. **启用开关**: AI 发送功能需要在偏好设置中启用后才能使用
2. **API 兼容**: 当前使用 OpenAI Responses API (`/v1/responses`)，不是标准的 Chat Completions API
3. **内容类型**: 当前仅支持文本类型内容发送，图片和文件类型暂不支持
4. **按钮显示**: 发送按钮只在 `aiSend.enabled` 为 true 且操作按钮配置中包含 "send" 时显示
5. **错误处理**: 网络错误或 API 返回错误时会显示错误提示

## 未来扩展建议

1. **多厂商支持**: 可考虑添加 Anthropic、Google 等厂商支持
2. **图片支持**: 实现图片 base64 编码后发送给支持视觉的模型
3. **流式输出**: 使用 `streamText` 实现 AI 回复的流式显示
4. **历史记录**: 保存 AI 回复到数据库，支持查看历史对话
5. **快捷指令**: 支持自定义提示词模板，如"总结这段文字"、"翻译为英文"等
