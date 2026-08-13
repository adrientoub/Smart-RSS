import { iconBody } from "../staticdb/icons.ts";

interface IconProps {
    name?: string | null;
    className?: string;
}

/** Inline SVG from the icon set; renders nothing for an unknown name. */
export function Icon({ name, className = "icon" }: IconProps) {
    const body = name ? iconBody(name) : undefined;
    if (!body) {
        return null;
    }
    return (
        <svg
            className={className}
            data-icon={name}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
            dangerouslySetInnerHTML={{ __html: body }}
        />
    );
}
