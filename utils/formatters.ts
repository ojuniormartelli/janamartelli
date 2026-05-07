
export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const parseCurrencyString = (value: string | number): number => {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  
  // Remove R$, espaços e símbolos indesejados
  let cleanStr = value.toString().replace(/[R$\s]/g, '').trim();

  // Se a string contiver vírgula e ponto (ex: 1.234,56), é formato BR clássico
  if (cleanStr.includes(',') && cleanStr.includes('.')) {
    cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
  } 
  // Se contiver apenas vírgula (ex: 10,30), substitui por ponto
  else if (cleanStr.includes(',') && !cleanStr.includes('.')) {
    cleanStr = cleanStr.replace(',', '.');
  }
  // Se contiver apenas um ponto e este ponto for separador de decimal (ex: 10.30)
  // não removemos nada, o parseFloat já entende.

  const num = parseFloat(cleanStr);
  return isNaN(num) ? 0 : num;
};

export const maskCPF = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1');
};

export const maskPhone = (value: string) => {
  let v = value.replace(/\D/g, '');
  
  // If it starts with 55 and has enough digits to be an international format for Brazil
  if (v.startsWith('55') && v.length > 10) {
    v = v.substring(2);
  }

  if (v.length <= 10) { // Fix or Mobile without leading 9
    return v
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1');
  } else { // Mobile with leading 9
    return v
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1');
  }
};

export const capitalizeName = (name: string) => {
  return name.toLowerCase().replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
};

export const getLocalDate = (date?: Date) => {
  const d = date || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getSizeWeight = (sizeName: string, dynamicSizes?: { name: string, sort_order: number }[]) => {
    if (dynamicSizes) {
        const found = dynamicSizes.find(s => s.name.toUpperCase() === sizeName.toUpperCase());
        if (found) return found.sort_order;
    }

    const weights: Record<string, number> = {
        'RN': 0, 'PB': 1, 'PP': 2, 'P': 3, 'M': 4, 'G': 5, 'GG': 6, 'XG': 7, 'XXG': 8, 'U': 9,
        '1': 10, '2': 11, '3': 12, '4': 13, '6': 14, '8': 15, '10': 16, '12': 17, '14': 18, '16': 19
    };
    return weights[sizeName.toUpperCase()] !== undefined ? weights[sizeName.toUpperCase()] : 999;
};
