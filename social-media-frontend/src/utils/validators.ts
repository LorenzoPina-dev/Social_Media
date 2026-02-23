export const validateEmail = (email: string): boolean => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

export const validateUsername = (username: string): boolean => {
  const regex = /^[a-zA-Z0-9_]{3,30}$/;
  return regex.test(username);
};

export const validatePassword = (password: string): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Almeno 8 caratteri');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Almeno una lettera maiuscola');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Almeno una lettera minuscola');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Almeno un numero');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Almeno un carattere speciale');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const validateUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const validateImageFile = (file: File): {
  isValid: boolean;
  error?: string;
} => {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  
  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: 'Formato non supportato. Usa JPG, PNG, GIF o WEBP',
    };
  }
  
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: 'Il file non può superare i 10MB',
    };
  }
  
  return { isValid: true };
};

export const validateVideoFile = (file: File): {
  isValid: boolean;
  error?: string;
} => {
  const maxSize = 100 * 1024 * 1024; // 100MB
  const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
  
  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: 'Formato non supportato. Usa MP4, MOV o AVI',
    };
  }
  
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: 'Il file non può superare i 100MB',
    };
  }
  
  return { isValid: true };
};