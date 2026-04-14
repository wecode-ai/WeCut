import { copyFile, exists, remove } from "@tauri-apps/plugin-fs";
import { useAsyncEffect, useReactive } from "ahooks";
import { isString } from "es-toolkit";
import { unionBy } from "es-toolkit/compat";
import { useContext } from "react";
import { getDefaultSaveImagePath } from "tauri-plugin-clipboard-x-api";
import { useSnapshot } from "valtio";
import { LISTEN_KEY } from "@/constants";
import { selectHistory } from "@/database/history";
import { getTagHistoryIds } from "@/database/tag";
import { MainContext } from "@/pages/Main";
import { clipboardStore } from "@/stores/clipboard";
import { isBlank } from "@/utils/is";
import { getSaveImagePath, join } from "@/utils/path";
import { useTauriListen } from "./useTauriListen";

interface Options {
  scrollToTop: () => void;
}

export const useHistoryList = (options: Options) => {
  const { scrollToTop } = options;
  const { rootState } = useContext(MainContext);
  const { activeTagId } = useSnapshot(clipboardStore);
  const state = useReactive({
    loading: false,
    noMore: false,
    page: 1,
    size: 20,
  });

  const fetchData = async () => {
    try {
      if (state.loading) return;

      state.loading = true;

      const { page } = state;

      // 获取标签筛选的历史ID列表
      let tagHistoryIds: string[] = [];
      if (activeTagId) {
        tagHistoryIds = await getTagHistoryIds(activeTagId);
      }

      const list = await selectHistory((qb) => {
        const { size } = state;
        const { group, search } = rootState;
        const isFavoriteGroup = group === "favorite";
        const isNormalGroup = group !== "all" && !isFavoriteGroup;
        const isTagGroup = !!activeTagId;

        return qb
          .$if(isTagGroup && tagHistoryIds.length > 0, (eb) =>
            eb.where("id", "in", tagHistoryIds),
          )
          .$if(isTagGroup && tagHistoryIds.length === 0, (eb) =>
            eb.where("id", "=", "__NO_MATCH__"),
          )
          .$if(!isTagGroup && isFavoriteGroup, (eb) =>
            eb.where("favorite", "=", true),
          )
          .$if(!isTagGroup && isNormalGroup, (eb) =>
            eb.where("group", "=", group),
          )
          .$if(!isBlank(search), (eb) => {
            return eb.where((eb) => {
              return eb.or([
                eb("search", "like", eb.val(`%${search}%`)),
                eb("note", "like", eb.val(`%${search}%`)),
              ]);
            });
          })
          .offset((page - 1) * size)
          .limit(size)
          .orderBy("createTime", "desc");
      });

      for (const item of list) {
        const { type, value } = item;

        if (!isString(value)) continue;

        if (type === "image") {
          const oldPath = join(getSaveImagePath(), value);
          const newPath = join(await getDefaultSaveImagePath(), value);

          if (await exists(oldPath)) {
            await copyFile(oldPath, newPath);

            remove(oldPath);
          }

          item.value = newPath;
        }

        if (type === "files") {
          item.value = JSON.parse(value);
        }
      }

      state.noMore = list.length === 0;

      if (page === 1) {
        rootState.list = list;

        if (state.noMore) return;

        return scrollToTop();
      }

      rootState.list = unionBy(rootState.list, list, "id");
    } finally {
      state.loading = false;
    }
  };

  const reload = () => {
    state.page = 1;
    state.noMore = false;

    return fetchData();
  };

  const loadMore = () => {
    if (state.noMore) return;

    state.page += 1;

    fetchData();
  };

  useTauriListen(LISTEN_KEY.REFRESH_CLIPBOARD_LIST, reload);

  useAsyncEffect(async () => {
    await reload();

    rootState.activeId = rootState.list[0]?.id;
  }, [rootState.group, rootState.search, activeTagId]);

  return {
    loadMore,
    reload,
  };
};
