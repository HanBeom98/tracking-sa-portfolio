export function buildLuckyPayload({ name, month, day, gender, language, now = new Date() }) {
  return {
    language,
    userInfo: {
      name,
      birthMonth: month,
      birthDay: day,
      gender,
    },
    currentDate: {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
    },
  };
}
