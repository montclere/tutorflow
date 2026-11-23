import type { AnchorHTMLAttributes, MouseEvent } from "react";
import { navigate } from "../../app/router";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

export function CabinetLink({ href, onClick, children, ...rest }: Props) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    navigate(href);
  };

  return (
    <a href={href} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
