import type { SeoLocale } from './catalog';

export type SeoGuideCopy = {
  title: string;
  description: string;
  heading: string;
  intro: string;
  sections: readonly { heading: string; body: string }[];
  comparison?: {
    heading: string;
    headers: readonly [string, string, string];
    rows: readonly (readonly [string, string, string])[];
  };
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
        'Compare Open Keychain STL and 3MF exports, see which color information they keep, and check the model in your slicer before printing.',
      heading: '3MF vs STL files: which export should you use?',
      intro:
        'Both formats carry printable geometry, but Open Keychain’s exports differ in how they represent colors. Choose by the file your slicer can use and the result you want to prepare.',
      comparison: {
        heading: 'Open Keychain exports at a glance',
        headers: ['Export', 'What it contains', 'Check before printing'],
        rows: [
          [
            'STL',
            'One combined mesh; no separate color regions.',
            'Confirm scale and sliced layers.',
          ],
          [
            '3MF · separate colors',
            'Backing and raised text use separate color regions.',
            'Check color regions and filament assignments.',
          ],
          [
            '3MF · merged',
            'Printable parts combined into one mesh.',
            'Confirm scale and sliced layers.',
          ],
        ],
      },
      sections: [
        {
          heading: 'What the STL export contains',
          body: 'Open Keychain writes a binary STL from one combined mesh. It is a straightforward choice for a single-color print, but this export does not keep separate colors for the backing and raised text.',
        },
        {
          heading: 'What the 3MF export contains',
          body: 'The separate-colors option assigns different color regions to the backing and raised text. The merged option combines the printable parts into one mesh. Open Keychain declares millimeters in its 3MF model; slicers can differ in how they display or use color assignments.',
        },
        {
          heading: 'Which format should you choose?',
          body: 'Choose STL when you want one mesh and do not need the file to carry separate color regions. Choose separate-colors 3MF when your slicer and print setup can use those regions. Choose merged 3MF when you prefer one combined mesh in a 3MF file.',
        },
        {
          heading: 'A 3MF model is not a printer profile',
          body: 'The Open Keychain 3MF export describes the model and its color regions. It does not choose your printer, filament profile, temperatures, layer height, or support settings. Set those in your slicer for your own machine and material.',
        },
        {
          heading: 'Check the model in your slicer',
          body: 'After importing either file, confirm the dimensions and bed orientation. For separate-colors 3MF, check how your slicer interprets the color regions and assign filaments if needed. Then inspect the sliced layer preview, including the keyring hole and any thin details, before printing.',
        },
        {
          heading: 'A practical starting point',
          body: 'For a single-color keychain, start with STL or merged 3MF. For a two-color result, try separate-colors 3MF and verify the assignments in the slicer. If a slicer does not preserve those regions on import, use its own tools to assign colors or export a single-color mesh.',
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
      description:
        'Сравните экспорт STL и 3MF в Open Keychain: какие цветовые области сохраняются и что проверить в слайсере перед печатью.',
      heading: 'STL или 3MF: какой экспорт выбрать?',
      intro:
        'Оба формата содержат геометрию для печати, но экспорт Open Keychain по-разному передаёт цвета. Выбирайте формат с учётом поддержки в слайсере и результата, который хотите получить.',
      comparison: {
        heading: 'Экспорт Open Keychain вкратце',
        headers: ['Экспорт', 'Что содержит файл', 'Что проверить перед печатью'],
        rows: [
          [
            'STL',
            'Одна объединённая сетка без отдельных цветовых областей.',
            'Проверьте масштаб и слои после нарезки.',
          ],
          [
            '3MF · отдельные цвета',
            'Основа и рельефный текст используют отдельные цветовые области.',
            'Проверьте цветовые области и назначение филаментов.',
          ],
          [
            '3MF · объединённый',
            'Печатные части объединены в одну сетку.',
            'Проверьте масштаб и слои после нарезки.',
          ],
        ],
      },
      sections: [
        {
          heading: 'Что входит в экспорт STL',
          body: 'Open Keychain создаёт бинарный STL из одной объединённой сетки. Это простой вариант для одноцветной печати, но такой файл не сохраняет отдельные цвета основы и рельефного текста.',
        },
        {
          heading: 'Что входит в экспорт 3MF',
          body: 'В режиме отдельных цветов основа и рельефный текст получают разные цветовые области. В объединённом режиме печатные части объединяются в одну сетку. В модели 3MF от Open Keychain указаны миллиметры; разные слайсеры могут по-разному показывать и обрабатывать цвета.',
        },
        {
          heading: 'Какой формат выбрать?',
          body: 'Выберите STL, если нужна одна сетка и не требуется сохранять отдельные цвета в файле. Выберите 3MF с отдельными цветами, если ваш слайсер и способ печати поддерживают эти области. Объединённый 3MF подойдёт, если нужна одна общая сетка в формате 3MF.',
        },
        {
          heading: '3MF не заменяет профиль принтера',
          body: 'Экспорт 3MF из Open Keychain описывает модель и её цветовые области. Он не выбирает принтер, профиль пластика, температуру, высоту слоя или настройки поддержек. Укажите их в слайсере с учётом своего принтера и материала.',
        },
        {
          heading: 'Проверьте модель в слайсере',
          body: 'После импорта проверьте размеры и ориентацию на столе. Для 3MF с отдельными цветами убедитесь, что слайсер правильно прочитал области, и при необходимости назначьте филаменты. Перед печатью просмотрите слои, отверстие для кольца и тонкие детали.',
        },
        {
          heading: 'С чего начать',
          body: 'Для одноцветного брелока начните с STL или объединённого 3MF. Для двух цветов попробуйте 3MF с отдельными цветами и проверьте назначения в слайсере. Если слайсер не сохраняет области при импорте, назначьте цвета его инструментами или экспортируйте одноцветную сетку.',
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
      description:
        'Порівняйте експорт STL і 3MF в Open Keychain: які кольорові ділянки зберігаються та що перевірити у слайсері перед друком.',
      heading: 'Файли 3MF чи STL: який експорт обрати?',
      intro:
        'Обидва формати містять геометрію для друку, але експорт Open Keychain по-різному передає кольори. Обирайте формат з огляду на підтримку у слайсері й бажаний результат.',
      comparison: {
        heading: 'Експорт Open Keychain коротко',
        headers: ['Експорт', 'Що містить файл', 'Що перевірити перед друком'],
        rows: [
          [
            'STL',
            'Одна об’єднана сітка без окремих кольорових ділянок.',
            'Перевірте масштаб і шари після нарізання.',
          ],
          [
            '3MF · окремі кольори',
            'Основа й рельєфний текст мають окремі кольорові ділянки.',
            'Перевірте кольорові ділянки й призначення філаментів.',
          ],
          [
            '3MF · об’єднаний',
            'Друковані частини об’єднані в одну сітку.',
            'Перевірте масштаб і шари після нарізання.',
          ],
        ],
      },
      sections: [
        {
          heading: 'Що містить експорт STL',
          body: 'Open Keychain створює бінарний STL з однієї об’єднаної сітки. Це простий варіант для одноколірного друку, але файл не зберігає окремі кольори основи й рельєфного тексту.',
        },
        {
          heading: 'Що містить експорт 3MF',
          body: 'У режимі окремих кольорів основа й рельєфний текст мають різні кольорові ділянки. В об’єднаному режимі друковані частини зливаються в одну сітку. Модель 3MF від Open Keychain вказує міліметри; слайсери можуть по-різному показувати й обробляти кольори.',
        },
        {
          heading: 'Який формат обрати?',
          body: 'Оберіть STL, якщо потрібна одна сітка й не потрібно зберігати окремі кольори у файлі. Оберіть 3MF з окремими кольорами, якщо ваш слайсер і спосіб друку підтримують ці ділянки. Об’єднаний 3MF підійде, якщо потрібна одна спільна сітка у форматі 3MF.',
        },
        {
          heading: '3MF не замінює профіль принтера',
          body: 'Експорт 3MF з Open Keychain описує модель і її кольорові ділянки. Він не вибирає принтер, профіль пластику, температуру, висоту шару чи налаштування підтримок. Задайте їх у слайсері з огляду на свій принтер і матеріал.',
        },
        {
          heading: 'Перевірте модель у слайсері',
          body: 'Після імпорту перевірте розміри й орієнтацію на столі. Для 3MF з окремими кольорами переконайтеся, що слайсер правильно прочитав ділянки, і за потреби призначте філаменти. Перед друком перегляньте шари, отвір для кільця й тонкі деталі.',
        },
        {
          heading: 'З чого почати',
          body: 'Для одноколірного брелока почніть зі STL або об’єднаного 3MF. Для двох кольорів спробуйте 3MF з окремими кольорами й перевірте призначення у слайсері. Якщо слайсер не зберігає ділянки під час імпорту, призначте кольори його інструментами або експортуйте одноколірну сітку.',
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
