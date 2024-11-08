export const CONCURRENT_THRESHOLD = 2;

export const getAccountKey = (accountId, minutesBack = 0) => {
  const intervalMarker = getIntervalMarker(minutesBack);
  return `${accountId}-${intervalMarker}`;
};

const getIntervalMarker = (minutesBack) => {
  const now = new Date();
  now.setTime(now.getTime() - minutesBack * 60000);
  now.setSeconds(0, 0);
  return now.getTime();
};
