import React from 'react';
import { useGeminiLive } from '../hooks/useGeminiLive';
import Icon from '../components/Icon';
import { ICONS } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';

type GeminiLiveHook = ReturnType<typeof useGeminiLive>;

interface GalleryPageProps {
  geminiLive: GeminiLiveHook;
}

const GalleryPage: React.FC<GalleryPageProps> = ({ geminiLive }) => {
    const { transcript } = geminiLive;
    const { t } = useLanguage();

    const imageEntries = transcript.filter(entry => entry.imageData);

    return (
        <div className="p-4 md:p-8 h-full overflow-y-auto">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">{t('galleryTitle')}</h2>
            {imageEntries.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                    {imageEntries.map((entry, index) => (
                        <div key={entry.id || index} className="group relative overflow-hidden rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 aspect-square">
                            <img src={`data:image/png;base64,${entry.imageData}`} alt={entry.text} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                            <p className="absolute bottom-0 left-0 p-3 text-white text-sm leading-tight line-clamp-2">{entry.text}</p>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 px-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <Icon path={ICONS.image} className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-500" />
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-white">{t('galleryEmpty')}</h3>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">{t('galleryEmptyPrompt')}</p>
                </div>
            )}
        </div>
    );
};

export default GalleryPage;
