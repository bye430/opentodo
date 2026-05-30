import type { SVGProps } from "react";

/** 品牌图标：深蓝底 + 白色对勾 */
export function AppLogo(props: SVGProps<SVGSVGElement>) {
  const { className, ...rest } = props;
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      {...rest}
    >
      <rect width="32" height="32" rx="7" fill="#1e3a8a" />
      <path
        d="M8 16l6 6 10-12"
        stroke="#ffffff"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
