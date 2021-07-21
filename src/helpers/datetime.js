export {
  toStringTodayYesterdayOrDate,
  toStringTodayYesterdayOrDateInNights,
  startOfDay,
  startOfHour,
  startOfEvening,
  toNZDateString,
};

function toStringTodayYesterdayOrDate(dateObject) {
  const todayStart = startOfDay(new Date());
  const dateTime = dateObject.getTime();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStart = startOfDay(yesterday);
  if (dateTime > todayStart.getTime()) {
    return "Today";
  } else if (dateTime > yesterdayStart.getTime()) {
    return "Yesterday";
  } else {
    return toNZDateString(dateObject);
  }
}

function toStringTodayYesterdayOrDateInNights(fromDate) {
  const now = new Date();
  const todayStart = startOfEvening(now);
  if (todayStart > now) {
    todayStart.setDate(todayStart.getDate() - 1);
  }
  const eventDayStart = startOfEvening(fromDate);
  const yesterday = new Date(todayStart);
  yesterday.setDate(yesterday.getDate() - 1);
  const oneYear = 1000 * 60 * 60 * 24 * 365;
  if (eventDayStart.getTime() === todayStart.getTime()) {
    const isInSameEvening =
      startOfDay(now).getTime() === startOfDay(eventDayStart).getTime();
    const isInSameMorningBeforeFiveAm =
      now.getHours() <= 5 &&
      startOfEvening(now).getTime() === startOfEvening(eventDayStart).getTime();
    if (isInSameEvening || isInSameMorningBeforeFiveAm) {
      return "Tonight";
    }
    return "Last night";
  } else if (eventDayStart.getTime() >= yesterday.getTime()) {
    if (now.getHours() >= 16 || now.getHours() <= 5) {
      return "Last night";
    }
    return "Two nights ago";
  } else if (fromDate) {
    return `Night of ${nthOfMonth(startOfEvening(fromDate))}${
      yesterday.getTime() - fromDate.getTime() > oneYear
        ? ", " + fromDate.getFullYear()
        : ""
    }`;
  }
}

function startOfHour(date) {
  const d = new Date(date.getTime());
  d.setSeconds(0);
  d.setMinutes(0);
  d.setMilliseconds(0);
  return d;
}

function startOfDay(date) {
  const d = startOfHour(date);
  d.setHours(0);
  return d;
}

function startOfEvening(date, eveningHours = 16) {
  // Set the time to the earliest midday from the given date.
  if (date.getHours() < 12) {
    date = new Date(date.getTime());
    date.setDate(date.getDate() - 1);
  }
  const d = startOfHour(date);
  d.setHours(eveningHours);
  return d;
}

function monthName(n) {
  switch (n) {
    case 1:
      return "January";
    case 2:
      return "February";
    case 3:
      return "March";
    case 4:
      return "April";
    case 5:
      return "May";
    case 6:
      return "June";
    case 7:
      return "July";
    case 8:
      return "August";
    case 9:
      return "September";
    case 10:
      return "October";
    case 11:
      return "November";
    case 12:
      return "December";
  }
}

function daySuffix(day) {
  const number = Number(day);
  const lastNumber = Number(day[day.length - 1]);
  if (number >= 4 && number <= 20) {
    return "th";
  } else if (lastNumber === 1) {
    return "st";
  } else if (lastNumber === 2) {
    return "nd";
  } else if (lastNumber === 3) {
    return "rd";
  }
  return "th";
}

function nthOfMonth(date) {
  const localDate = date.toLocaleDateString("en-NZ").split("/");
  const suffix = daySuffix(localDate[0]);
  const month = monthName(Number(localDate[1]));
  return `${localDate[0]}${suffix} of ${month}`;
}

function toNZDateString(date) {
  return date.toLocaleDateString("en-NZ");
}
