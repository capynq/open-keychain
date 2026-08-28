import type { SeoLocale } from './catalog';

export type SeoGuideCopy = {
  title: string;
  description: string;
  heading: string;
  intro: string;
  sections: readonly { heading: string; body: string }[];
  faq?: readonly { question: string; answer: string }[];
};

type Localized<T> = Record<SeoLocale, T>;

export const SEO_HUB_COPY: Localized<{
  title: string;
  description: string;
  heading: string;
  intro: string;
}> = {
  en: {
    title: 'Open Keychain 3D | 3D printing guides',
    description:
      'Practical guides for designing and 3D printing name keychains, articulated names, nameplates, and plant labels.',
    heading: 'Practical guides for printable names',
    intro:
      'Learn how to choose a template, prepare text, and get a reliable first print from Open Keychain 3D.',
  },
  ru: {
    title: 'Open Keychain 3D | Руководства по 3D-печати',
    description:
      'Практические руководства по созданию и 3D-печати именных брелоков, шарнирных имён, табличек и бирок.',
    heading: 'Практические руководства по печатным именам',
    intro:
      'Узнайте, как выбрать шаблон, подготовить текст и получить удачную первую печать в Open Keychain 3D.',
  },
  uk: {
    title: 'Open Keychain 3D | Посібники з 3D-друку',
    description:
      'Практичні посібники зі створення та 3D-друку іменних брелоків, рухомих імен, табличок і етикеток.',
    heading: 'Практичні посібники для друкованих імен',
    intro:
      'Дізнайтеся, як вибрати шаблон, підготувати текст і отримати вдалий перший друк в Open Keychain 3D.',
  },
};

export const SEO_GUIDE_COPY: Record<SeoLocale, Record<string, SeoGuideCopy>> = {
  en: {
    stlVs3mf: {
      title: 'Open Keychain 3D | 3MF vs STL files for 3D printing',
      description:
        'Compare 3MF vs STL files for 3D printing and choose the right export for your slicer workflow.',
      heading: '3MF vs STL files: which export should you use?',
      intro:
        '3MF vs STL files suit different slicer workflows. Here is a concise comparison for printable name designs.',
      sections: [
        {
          heading: 'Choose STL for broad compatibility',
          body: 'STL is a simple mesh format supported by virtually every slicer. Use it when you need one printable surface and the widest compatibility.',
        },
        {
          heading: 'Choose 3MF for richer projects',
          body: '3MF can keep multiple objects and separate colors together. Use it when your slicer supports 3MF and you want a more complete project file.',
        },
        {
          heading: 'Check the sliced preview',
          body: 'Whichever format you choose, inspect the sliced layers and dimensions before printing.',
        },
      ],
    },
    nameKeychainPrinting: {
      title: 'Open Keychain 3D | Print a name keychain',
      description:
        'Learn how to design and 3D print a personalized name keychain with a sturdy backing and keyring hole.',
      heading: 'How to 3D print a name keychain',
      intro: 'A simple workflow for turning a name into a useful, printable keychain.',
      sections: [
        {
          heading: 'Choose a short, readable name',
          body: 'Start with a name or nickname that fits comfortably on the preview. Bold, rounded fonts are usually easiest to read and print.',
        },
        {
          heading: 'Check the backing and hole',
          body: 'Keep enough material around the keyring hole and inspect the generated model in your slicer before printing.',
        },
        {
          heading: 'Export and test',
          body: 'Export STL or 3MF, slice with your usual profile, and make one small test print before producing a batch.',
        },
      ],
    },
    articulatedPrinting: {
      title: 'Open Keychain 3D | Print an articulated name',
      description:
        'Prepare and print a flexible articulated name keychain with validated captive joints.',
      heading: 'Articulated vs standard keychains: which should you print?',
      intro:
        'Compare articulated and standard keychains, then choose the printable format that fits your name and use case.',
      sections: [
        {
          heading: 'Articulated keychains need clearance',
          body: 'Articulated letters need strong strokes and enough room for joints. Short names generally produce the most dependable results.',
        },
        {
          heading: 'Standard keychains are simpler',
          body: 'A standard name keychain has one connected body and is often the easier choice for a first print or longer name.',
        },
        {
          heading: 'Print flat and move gently',
          body: 'Follow your filament and printer profile, then free the joints carefully after the first layer and cooling.',
        },
      ],
    },
    plantLabelPrinting: {
      title: 'Open Keychain 3D | Print a plant label',
      description:
        'Create a durable 3D printable plant label with a pointed stake for pots and garden beds.',
      heading: 'How to 3D print a plant label',
      intro: 'Turn a plant name or herb into a clear marker for pots, seedlings, and garden rows.',
      sections: [
        {
          heading: 'Keep the label legible',
          body: 'Use a short plant name and a bold font. Raised lettering remains easier to read outdoors than fine details.',
        },
        {
          heading: 'Choose a suitable stake',
          body: 'Place the pointed stake where it can enter the soil without stressing the label. Preview the full height before exporting.',
        },
        {
          heading: 'Use durable material',
          body: 'Choose filament suited to your environment and test one label first; sunlight, moisture, and temperature affect longevity.',
        },
      ],
    },
  },
  ru: {
    stlVs3mf: {
      title: 'Open Keychain 3D | STL или 3MF',
      description: 'Разберитесь, когда использовать STL или 3MF для персонализированной модели.',
      heading: 'STL или 3MF: какой экспорт выбрать?',
      intro:
        'Оба формата подходят для печати, но рассчитаны на разные рабочие процессы в слайсере.',
      sections: [
        {
          heading: 'Выберите STL для совместимости',
          body: 'STL поддерживает почти любой слайсер. Используйте его для одной печатной поверхности и максимальной совместимости.',
        },
        {
          heading: 'Выберите 3MF для сложных проектов',
          body: '3MF может хранить несколько объектов и отдельные цвета. Он удобен, если ваш слайсер поддерживает этот формат.',
        },
        {
          heading: 'Проверьте предпросмотр',
          body: 'В любом формате проверьте слои и размеры в слайсере перед печатью.',
        },
      ],
    },
    nameKeychainPrinting: {
      title: 'Open Keychain 3D | Печать именного брелока',
      description:
        'Практическое руководство по созданию и 3D-печати именного брелока с прочной основой и отверстием.',
      heading: 'Как напечатать именной брелок',
      intro: 'Простой путь от имени до удобного брелока для печати.',
      sections: [
        {
          heading: 'Выберите короткое читаемое имя',
          body: 'Начните с имени или псевдонима, который хорошо помещается в предпросмотре. Жирные округлые шрифты проще читать и печатать.',
        },
        {
          heading: 'Проверьте основу и отверстие',
          body: 'Оставьте достаточно материала вокруг отверстия для кольца и проверьте модель в слайсере.',
        },
        {
          heading: 'Экспортируйте и протестируйте',
          body: 'Скачайте STL или 3MF, используйте привычный профиль слайсера и сначала сделайте небольшой тест.',
        },
      ],
    },
    articulatedPrinting: {
      title: 'Open Keychain 3D | Печать шарнирного имени',
      description:
        'Подготовьте и напечатайте гибкий шарнирный именной брелок с проверенными соединениями.',
      heading: 'Как напечатать шарнирное имя',
      intro: 'Соединённые буквы и захватные шарниры создают гибкий и необычный брелок.',
      sections: [
        {
          heading: 'Используйте плотный шрифт и короткий текст',
          body: 'Подвижным буквам нужны толстые штрихи и место для шарниров. Короткие имена обычно надёжнее.',
        },
        {
          heading: 'Соблюдайте зазор шарниров',
          body: 'Конструктор проверяет геометрию. При ошибке попробуйте короткое имя, плотный шрифт или больший зазор.',
        },
        {
          heading: 'Печатайте ровно и освобождайте осторожно',
          body: 'Следуйте профилю материала и принтера, а после остывания аккуратно разработайте шарниры.',
        },
      ],
    },
    plantLabelPrinting: {
      title: 'Open Keychain 3D | Печать бирки для растения',
      description:
        'Создайте прочную бирку для растений с заострённым держателем для горшков и грядок.',
      heading: 'Как напечатать бирку для растения',
      intro: 'Превратите название растения или травы в понятную бирку для сада.',
      sections: [
        {
          heading: 'Сохраните читаемость',
          body: 'Используйте короткое название и плотный шрифт. Рельефные буквы лучше видны снаружи.',
        },
        {
          heading: 'Подберите держатель',
          body: 'Разместите заострённый держатель так, чтобы он входил в землю без нагрузки на бирку.',
        },
        {
          heading: 'Выберите стойкий материал',
          body: 'Подберите пластик для ваших условий и сначала протестируйте одну бирку.',
        },
      ],
    },
  },
  uk: {
    stlVs3mf: {
      title: 'Open Keychain 3D | Файли 3MF чи STL для 3D-друку',
      description: 'Порівняйте файли 3MF і STL для 3D-друку та оберіть формат для свого слайсера.',
      heading: 'Файли 3MF чи STL: який експорт обрати?',
      intro:
        'Файли 3MF і STL підходять для різних робочих процесів у слайсері. Ось коротке порівняння для іменних моделей.',
      sections: [
        {
          heading: 'Оберіть STL для сумісності',
          body: 'STL підтримує майже кожен слайсер. Використовуйте його для однієї поверхні та максимальної сумісності.',
        },
        {
          heading: 'Оберіть 3MF для складніших проєктів',
          body: '3MF може зберігати кілька об’єктів і окремі кольори. Він зручний, якщо ваш слайсер підтримує цей формат.',
        },
        {
          heading: 'Перевірте перегляд після нарізання',
          body: 'У будь-якому форматі перевірте шари й розміри в слайсері перед друком.',
        },
      ],
    },
    nameKeychainPrinting: {
      title: 'Open Keychain 3D | Друк іменного брелока',
      description:
        'Дізнайтеся, як створити та надрукувати іменний брелок із міцною основою й отвором.',
      heading: 'Як надрукувати іменний брелок',
      intro: 'Простий шлях від імені до корисного брелока для 3D-друку.',
      sections: [
        {
          heading: 'Оберіть коротке читабельне ім’я',
          body: 'Почніть з імені або псевдоніма, який добре поміщається в перегляді. Жирні округлі шрифти легше читати й друкувати.',
        },
        {
          heading: 'Перевірте основу та отвір',
          body: 'Залиште достатньо матеріалу навколо отвору для кільця та перевірте модель у слайсері.',
        },
        {
          heading: 'Експортуйте й протестуйте',
          body: 'Завантажте STL або 3MF, скористайтеся звичним профілем і спершу зробіть тестовий друк.',
        },
      ],
    },
    articulatedPrinting: {
      title: 'Open Keychain 3D | Шарнірний чи звичайний брелок',
      description:
        'Підготуйте та надрукуйте гнучкий іменний брелок із перевіреними рухомими з’єднаннями.',
      heading: 'Шарнірний чи звичайний брелок: що надрукувати?',
      intro:
        'Порівняйте шарнірний і звичайний брелоки та оберіть формат для свого імені й завдання.',
      sections: [
        {
          heading: 'Використовуйте щільний шрифт і короткий текст',
          body: 'Рухомим літерам потрібні товсті штрихи та місце для шарнірів. Короткі імена зазвичай надійніші.',
        },
        {
          heading: 'Дотримуйтеся зазору шарнірів',
          body: 'Конструктор перевіряє геометрію. За помилки спробуйте коротше ім’я, щільніший шрифт або більший зазор.',
        },
        {
          heading: 'Друкуйте рівно та звільняйте обережно',
          body: 'Дотримуйтеся профілю матеріалу й принтера, а після охолодження обережно розробіть шарніри.',
        },
      ],
    },
    plantLabelPrinting: {
      title: 'Open Keychain 3D | Друк етикетки для рослини',
      description:
        'Створіть міцну етикетку для рослин із загостреним держаком для горщиків і грядок.',
      heading: 'Як надрукувати етикетку для рослини',
      intro: 'Перетворіть назву рослини чи трави на зрозумілу садову етикетку.',
      sections: [
        {
          heading: 'Збережіть читабельність',
          body: 'Використовуйте коротку назву та щільний шрифт. Рельєфні літери краще видно надворі.',
        },
        {
          heading: 'Оберіть держак',
          body: 'Розмістіть загострений держак так, щоб він входив у ґрунт без навантаження на етикетку.',
        },
        {
          heading: 'Оберіть стійкий матеріал',
          body: 'Підберіть пластик для ваших умов і спершу протестуйте одну етикетку.',
        },
      ],
    },
  },
};
