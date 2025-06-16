import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import ApiError from "./ApiError.js";

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

const ACCEPTED_FORMATS = [
	"YYYY-MM-DD",
	"DD/MM/YYYY",
	"MM-DD-YYYY",
	"MMM D, YYYY",
	"DD-MM-YYYY",
	dayjs.ISO_8601,
];

const parseDate = (dateString) => {
	// 1. Parse in UTC mode to avoid local timezone shifts
	const parsed = dayjs.utc(dateString, ACCEPTED_FORMATS, true);
	if (!parsed.isValid()) {
		throw new ApiError(400, "Invalid date format provided");
	}
	// 2. Set to start of day (00:00 UTC) and return ISO string
	return parsed.startOf("day").toISOString(); // e.g. "2025-05-22T00:00:00.000Z"
};

export default parseDate;
