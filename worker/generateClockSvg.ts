const HEIGHT = 290;

/** Left centre of the page: 20 mm from the left edge, vertically centred. */
const CLOCK_CENTER_X = 95;
const CLOCK_CENTER_Y = HEIGHT / 2;
const CLOCK_RADIUS = 75;

function getTimeParts(date: Date, timezone: string) {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
    }).formatToParts(date);

    const get = (type: string) =>
        Number(parts.find((part) => part.type === type)?.value ?? 0);

    return {
        hours: get("hour"),
        minutes: get("minute"),
        seconds: get("second"),
    };
}

function polarPoint(angle: number, length: number) {
    const radians = (angle * Math.PI) / 180;

    return {
        x: CLOCK_CENTER_X + Math.sin(radians) * length,
        y: CLOCK_CENTER_Y - Math.cos(radians) * length,
    };
}

/**
 * The clock as SVG elements in mm. `transform` goes on every element (not on the group,
 * which svg-to-gcode would ignore); the page uses it to scale mm to px.
 */
export function generateClockSvg(
    date = new Date(),
    timezone = "Asia/Kolkata",
    transform = "",
) {
    const { hours, minutes } = getTimeParts(date, timezone);
    const scaled = transform ? `transform="${transform}"` : "";

    const hourAngle = ((hours % 12) + minutes / 60) * 30;
    const minuteAngle = minutes * 6;

    const hourHand = polarPoint(hourAngle, 35);
    const minuteHand = polarPoint(minuteAngle, 53);

    const ticks = Array.from({ length: 12 }, (_, index) => {
        const angle = index * 30;
        const start = polarPoint(angle, 64);
        const end = polarPoint(angle, 70);

        return `
        <line
            ${scaled}
            x1="${start.x}" y1="${start.y}"
            x2="${end.x}" y2="${end.y}"
            stroke="#111111"
            stroke-width="1.8"
        />
        `;
    }).join("");

    return `
        <g id="clock">
            <circle
                ${scaled}
                cx="${CLOCK_CENTER_X}"
                cy="${CLOCK_CENTER_Y}"
                r="${CLOCK_RADIUS}"
                fill="none"
                stroke="#111111"
                stroke-width="2"
            />

            ${ticks}

            <line
                ${scaled}
                x1="${CLOCK_CENTER_X}" y1="${CLOCK_CENTER_Y}"
                x2="${hourHand.x}" y2="${hourHand.y}"
                stroke="#111111"
                stroke-width="4"
                stroke-linecap="round"
            />

            <line
                ${scaled}
                x1="${CLOCK_CENTER_X}" y1="${CLOCK_CENTER_Y}"
                x2="${minuteHand.x}" y2="${minuteHand.y}"
                stroke="#111111"
                stroke-width="2.5"
                stroke-linecap="round"
            />

            <circle
                ${scaled}
                cx="${CLOCK_CENTER_X}"
                cy="${CLOCK_CENTER_Y}"
                r="3"
                fill="#111111"
            />
        </g>
    `;
}