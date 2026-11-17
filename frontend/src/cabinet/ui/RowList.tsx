import { Children, Fragment, type ReactNode } from "react";
import { Separator } from "@/shared/ui/kit/separator";

export function RowList({ children }: { children: ReactNode }) {
  return (
    <div>
      {Children.toArray(children).map((child, index) => (
        <Fragment key={index}>
          {index > 0 && <Separator />}
          {child}
        </Fragment>
      ))}
    </div>
  );
}
