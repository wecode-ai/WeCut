import { Flex } from "antd";
import type { FC } from "react";
import LocalImage from "@/components/LocalImage";
import type { DatabaseSchemaHistory } from "@/types/database";
import { isImage } from "@/utils/is";
import File from "./components/File";

const Files: FC<DatabaseSchemaHistory<"files">> = (props) => {
  const { value, sourceAppIcon } = props;

  const getClassName = () => {
    if (value.length === 1) {
      if (isImage(value[0])) {
        return "max-h-21.5";
      }

      return "h-7";
    }

    if (value.length === 2) {
      return "h-14";
    }

    return "h-21.5";
  };

  if (sourceAppIcon) {
    return (
      <Flex className={getClassName()} gap={6}>
        <LocalImage
          className="h-full shrink-0 object-contain"
          src={sourceAppIcon}
        />
        <div className="min-w-0 flex-1">
          {value.map((path) => {
            return (
              <File count={value.length} key={path} nameOnly path={path} />
            );
          })}
        </div>
      </Flex>
    );
  }

  return (
    <div className={getClassName()}>
      {value.map((path) => {
        return <File count={value.length} key={path} path={path} />;
      })}
    </div>
  );
};

export default Files;
