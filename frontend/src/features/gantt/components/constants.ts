export const dayWidth = 22;
export const rowHeight = 34;
const now = new Date();
export const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
