import { useEffect, useState } from "react";

export const getDailyRotationIndex = (date: Date, itemCount: number) => {
  if (itemCount <= 0) return -1;
  const currentDay = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const startOfYear = Date.UTC(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((currentDay - startOfYear) / 86_400_000);
  return Math.abs(dayOfYear) % itemCount;
};

export const useDailyRotationItem = <Item,>(items: readonly Item[]) => {
  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    let timeoutId: number | undefined;

    const scheduleNextDay = () => {
      const now = new Date();
      const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timeoutId = window.setTimeout(() => {
        setToday(new Date());
        scheduleNextDay();
      }, Math.max(1_000, nextDay.getTime() - now.getTime() + 100));
    };

    scheduleNextDay();
    return () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, []);

  return items[getDailyRotationIndex(today, items.length)];
};

