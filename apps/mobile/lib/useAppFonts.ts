import { useFonts } from '@expo-google-fonts/material-symbols-outlined/useFonts';
import { MaterialSymbolsOutlined_400Regular } from '@expo-google-fonts/material-symbols-outlined/400Regular';
import { MaterialSymbolsOutlined_400Regular_Filled } from '@expo-google-fonts/material-symbols-outlined/400Regular_Filled';

/** Web ile aynı Material Symbols Outlined */
export function useAppFonts() {
  return useFonts({
    MaterialSymbolsOutlined_400Regular,
    MaterialSymbolsOutlined_400Regular_Filled,
  });
}
