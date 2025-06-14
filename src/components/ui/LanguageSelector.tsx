import React from 'react';
import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { languageOptions, changeLanguage } from '@/lib/i18n';
import { GlobeIcon } from "@radix-ui/react-icons"
import { Flex } from '@radix-ui/themes';

interface LanguageSelectorProps {
  className?: string;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ className }) => {
  const { i18n, t } = useTranslation();

  const handleLanguageChange = (language: string) => {
    changeLanguage(language);
  };

  return (
    <Flex direction="row" align="center" gap="2" className={className}>
      <GlobeIcon className="w-6 h-6" />
      <Select value={i18n.language} onValueChange={handleLanguageChange}>
        <SelectTrigger className="w-32">
          <SelectValue placeholder={t("common.selectLanguage")} />
        </SelectTrigger>
        <SelectContent>
          {languageOptions.map((option) => (
            <SelectItem key={option.code} value={option.code} className="hover:bg-gray-100">
              <div className="flex items-center space-x-2 ">
                <span>{option.nativeName}</span>
                {option.code !== option.nativeName && (
                  <span className="text-xs text-gray-500">({option.name})</span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Flex>
  );
};

export default LanguageSelector; 