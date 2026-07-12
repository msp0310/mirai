import { Suspense } from "react";

import type { AppWorkbenchController } from "../AppWorkbench";
import { ViewLoading } from "../workbenchHelpers";
import { WorkbenchConfigurationViews } from "./WorkbenchConfigurationViews";
import { WorkbenchOrganizationViews } from "./WorkbenchOrganizationViews";
import { WorkbenchProjectViews } from "./WorkbenchProjectViews";

type WorkbenchMainViewsProps = {
  controller: AppWorkbenchController;
};

/** 画面カテゴリごとのルートコンポーネントを同じ遅延境界内に配置します。 */
export function WorkbenchMainViews({ controller }: WorkbenchMainViewsProps) {
  return (
    <Suspense fallback={<ViewLoading label="ビューを読み込み中" />}>
      <WorkbenchConfigurationViews controller={controller} />
      <WorkbenchOrganizationViews controller={controller} />
      <WorkbenchProjectViews controller={controller} />
    </Suspense>
  );
}
