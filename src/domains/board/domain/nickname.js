export function generateRandomNickname() {
  const adjectives = ["친절한", "용감한", "슬기로운", "재빠른", "고요한", "명랑한"];
  const nouns = ["호랑이", "사자", "토끼", "거북이", "다람쥐", "고양이"];
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 1000);
  return `${adjective} ${noun} ${number}`;
}
