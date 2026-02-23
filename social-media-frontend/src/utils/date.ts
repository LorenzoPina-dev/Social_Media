import { format, formatDistanceToNow, formatDistance, isToday, isYesterday, differenceInDays } from 'date-fns';
import { it } from 'date-fns/locale';

export const formatDate = (date: string | Date, formatStr: string = 'dd MMMM yyyy') => {
  return format(new Date(date), formatStr, { locale: it });
};

export const formatTimeAgo = (date: string | Date) => {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: it });
};

export const formatRelativeDate = (date: string | Date) => {
  const d = new Date(date);
  
  if (isToday(d)) {
    return format(d, "'Oggi alle' HH:mm", { locale: it });
  }
  
  if (isYesterday(d)) {
    return format(d, "'Ieri alle' HH:mm", { locale: it });
  }
  
  const daysDiff = differenceInDays(new Date(), d);
  if (daysDiff < 7) {
    return formatDistance(d, new Date(), { addSuffix: true, locale: it });
  }
  
  return format(d, 'dd MMMM yyyy', { locale: it });
};

export const formatMessageTime = (date: string | Date) => {
  const d = new Date(date);
  
  if (isToday(d)) {
    return format(d, 'HH:mm', { locale: it });
  }
  
  if (isYesterday(d)) {
    return 'Ieri';
  }
  
  return format(d, 'dd/MM/yyyy', { locale: it });
};