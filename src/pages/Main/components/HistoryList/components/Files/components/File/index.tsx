import { useAsyncEffect, useReactive } from "ahooks";
import { Flex } from "antd";
import clsx from "clsx";
import type { FC } from "react";
import {
  fullName,
  icon,
  type Metadata,
  metadata,
} from "tauri-plugin-fs-pro-api";
import LocalImage from "@/components/LocalImage";
import { isImage, isLinux } from "@/utils/is";

interface FileProps {
  path: string;
  count: number;
  nameOnly?: boolean;
}

interface State extends Partial<Metadata> {
  icon?: string;
}

const File: FC<FileProps> = (props) => {
  const { path, count, nameOnly } = props;

  const state = useReactive<State>({});

  useAsyncEffect(async () => {
    try {
      const data = await metadata(path, { omitSize: true });

      Object.assign(state, data);

      if (nameOnly || isLinux) return;

      state.icon = await icon(path, { size: 256 });
    } catch {
      state.fullName = await fullName(path);
    }
  }, [path]);

  const renderContent = () => {
    if (!nameOnly && state.isExist && count === 1 && isImage(path)) {
      return <LocalImage className="max-h-21.5" src={path} />;
    }

    const height = 100 / Math.min(count, 3);

    if (nameOnly) {
      return (
        <div
          className={clsx({ "py-0.5": count > 1 })}
          style={{ height: `${height}%` }}
        >
          <Flex align="center" className="h-full">
            <span
              className={clsx("truncate", {
                "text-danger line-through": !state.isExist,
              })}
            >
              {state.fullName}
            </span>
          </Flex>
        </div>
      );
    }

    return (
      <div
        className={clsx({ "py-0.5": count > 1 })}
        style={{ height: `${height}%` }}
      >
        <Flex align="center" className="h-full" gap={4}>
          {state.icon && <LocalImage className="h-full" src={state.icon} />}

          <span
            className={clsx("truncate", {
              "text-danger line-through": !state.isExist,
            })}
          >
            {state.fullName}
          </span>
        </Flex>
      </div>
    );
  };

  return renderContent();
};

export default File;
