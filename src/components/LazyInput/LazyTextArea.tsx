import { Input } from "antd";
import type { TextAreaProps } from "antd/es/input";
import { useEffect, useRef, useState } from "react";

interface LazyTextAreaProps extends Omit<TextAreaProps, "onChange" | "value"> {
  onChange?: (value: string) => void;
  value?: string;
}

/**
 * 懒提交多行文本框
 * - 本地编辑时实时触发 onChange（实时保存）
 * - 失焦(blur)或按 Ctrl+Enter 时也会触发 onChange
 * - 解决 valtio useSnapshot 导致的输入时光标跳到最后的问题
 */
const LazyTextArea = ({ onChange, value, ...rest }: LazyTextAreaProps) => {
  const [localValue, setLocalValue] = useState(value ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevValueRef = useRef(value);

  // 只在 value 真正发生变化且输入框无焦点时才同步
  // 避免外部状态更新导致光标跳动
  useEffect(() => {
    // 如果输入框有焦点，不从外部同步（避免打断用户输入）
    if (document.activeElement === textareaRef.current) {
      return;
    }
    // 只有 value 真正变化时才同步
    if (value !== prevValueRef.current) {
      prevValueRef.current = value;
      setLocalValue(value ?? "");
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    // 实时触发 onChange，实现实时保存
    onChange?.(newValue);
  };

  const commit = () => {
    onChange?.(localValue);
  };

  const handleBlur = () => {
    commit();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && e.ctrlKey) {
      commit();
      e.currentTarget.blur();
    }
  };

  return (
    <Input.TextArea
      {...rest}
      onBlur={handleBlur}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      ref={textareaRef}
      value={localValue}
    />
  );
};

export default LazyTextArea;
