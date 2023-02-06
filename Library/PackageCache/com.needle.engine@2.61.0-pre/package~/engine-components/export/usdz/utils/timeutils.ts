


export function getFormattedDate() {
    var date = new Date();

    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours();
    const min = date.getMinutes();
    const sec = date.getSeconds();

    const s_month = (month < 10 ? "0" : "") + month;
    const s_day = (day < 10 ? "0" : "") + day;
    const s_hour = (hour < 10 ? "0" : "") + hour;
    const s_min = (min < 10 ? "0" : "") + min;
    const s_sec = (sec < 10 ? "0" : "") + sec;

    return date.getFullYear() + s_month + s_day + "-" + s_hour + s_min + s_sec;
}