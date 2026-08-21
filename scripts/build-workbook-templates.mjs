import fs from 'node:fs/promises'
import path from 'node:path'
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool'

const outputDir = process.argv[2] ?? 'public/templates'
await fs.mkdir(outputDir, { recursive: true })

const COLORS = {
  green: '#17685D',
  deep: '#103E38',
  mint: '#EAF3F0',
  gold: '#B58A45',
  goldLight: '#F6EEDC',
  ink: '#17312D',
  muted: '#64756F',
  line: '#D9E3DF',
  pale: '#F5F8F6',
  white: '#FFFFFF',
  red: '#A64C4C',
  redLight: '#F9EAEA',
}

const BASE_FONT = { name: 'Arial', size: 11, color: COLORS.ink }

function configureSheet(sheet) {
  sheet.showGridLines = false
  sheet.getRange('A1:Z250').format.font = BASE_FONT
  sheet.getRange('A1:Z250').format.horizontalAlignment = 'right'
  sheet.getRange('A1:Z250').format.verticalAlignment = 'center'
}

function titleBlock(sheet, title, subtitle, endColumn = 'H') {
  sheet.mergeCells(`A1:${endColumn}1`)
  sheet.getRange('A1').values = [[title]]
  sheet.getRange(`A1:${endColumn}1`).format = {
    fill: COLORS.deep,
    font: { ...BASE_FONT, size: 18, bold: true, color: COLORS.white },
    horizontalAlignment: 'right',
    verticalAlignment: 'center',
    rowHeight: 36,
  }
  sheet.mergeCells(`A2:${endColumn}2`)
  sheet.getRange('A2').values = [[subtitle]]
  sheet.getRange(`A2:${endColumn}2`).format = {
    fill: COLORS.mint,
    font: { ...BASE_FONT, size: 10, color: COLORS.green },
    horizontalAlignment: 'right',
    wrapText: true,
    rowHeight: 31,
    borders: { preset: 'outside', style: 'thin', color: COLORS.line },
  }
  sheet.getRange(`A3:${endColumn}3`).format.rowHeight = 7
}

function styleHeader(sheet, range) {
  sheet.getRange(range).format = {
    fill: COLORS.green,
    font: { ...BASE_FONT, size: 10, bold: true, color: COLORS.white },
    horizontalAlignment: 'center',
    verticalAlignment: 'center',
    wrapText: true,
    rowHeight: 32,
    borders: { preset: 'all', style: 'thin', color: COLORS.deep },
  }
}

function styleBody(sheet, range) {
  sheet.getRange(range).format = {
    font: BASE_FONT,
    horizontalAlignment: 'right',
    verticalAlignment: 'center',
    wrapText: true,
    borders: { preset: 'all', style: 'thin', color: COLORS.line },
    rowHeight: 27,
  }
}

function setWidths(sheet, mapping) {
  for (const [column, width] of Object.entries(mapping)) {
    sheet.getRange(`${column}:${column}`).format.columnWidth = width
  }
}

function addInstructionSheet(workbook, title, purpose, fields, steps, checks) {
  const sheet = workbook.worksheets.add('تعليمات')
  configureSheet(sheet)
  titleBlock(sheet, title, purpose, 'F')
  sheet.mergeCells('A4:F4')
  sheet.getRange('A4').values = [['قاعدة الاستخدام: هذا قالب فارغ؛ أي صف موسوم «مثال توضيحي» يُحذف قبل الاعتماد، ولا تمثل الحالة المعروضة إثبات تسليم فعلي.']]
  sheet.getRange('A4:F4').format = {
    fill: COLORS.goldLight,
    font: { ...BASE_FONT, size: 10, bold: true, color: COLORS.ink },
    wrapText: true,
    rowHeight: 42,
    borders: { preset: 'all', style: 'thin', color: COLORS.gold },
  }

  sheet.getRange('A6:B6').values = [['الحقل', 'القيمة']]
  styleHeader(sheet, 'A6:B6')
  const metadata = [
    ['رمز المهمة', '[TASK-ID]'],
    ['القسم / اللجنة', '[يُستكمل]'],
    ['الفصل / الأسبوع', '[1448-F1] / [W01]'],
    ['إصدار الملف', 'v01'],
    ['حالة الوثيقة', 'مسودة / تحت المراجعة / معتمدة'],
    ...fields,
  ]
  sheet.getRange(`A7:B${6 + metadata.length}`).values = metadata
  styleBody(sheet, `A7:B${6 + metadata.length}`)
  sheet.getRange(`A7:A${6 + metadata.length}`).format = { fill: COLORS.mint, font: { ...BASE_FONT, bold: true, color: COLORS.green } }

  const start = 8 + metadata.length
  sheet.getRange(`D6:F6`).values = [['الخطوة', 'التنفيذ', 'تم؟']]
  styleHeader(sheet, 'D6:F6')
  const stepRows = steps.map((step, index) => [index + 1, step, '☐'])
  sheet.getRange(`D7:F${6 + stepRows.length}`).values = stepRows
  styleBody(sheet, `D7:F${6 + stepRows.length}`)
  sheet.getRange(`D7:D${6 + stepRows.length}`).format.horizontalAlignment = 'center'
  sheet.getRange(`F7:F${6 + stepRows.length}`).format.horizontalAlignment = 'center'

  sheet.mergeCells(`A${start}:F${start}`)
  sheet.getRange(`A${start}`).values = [['فحص الجودة قبل الاعتماد']]
  sheet.getRange(`A${start}:F${start}`).format = {
    fill: COLORS.deep,
    font: { ...BASE_FONT, bold: true, color: COLORS.white },
    rowHeight: 27,
  }
  const checkRows = checks.map((check, index) => [index + 1, check, '☐', '', '', ''])
  sheet.getRange(`A${start + 1}:F${start + checkRows.length}`).values = checkRows
  styleBody(sheet, `A${start + 1}:F${start + checkRows.length}`)
  sheet.mergeCells(`B${start + 1}:F${start + 1}`)
  for (let row = start + 2; row <= start + checkRows.length; row += 1) sheet.mergeCells(`B${row}:F${row}`)

  setWidths(sheet, { A: 7, B: 30, C: 3, D: 8, E: 42, F: 8 })
  sheet.freezePanes.freezeRows(3)
  return sheet
}

async function saveWorkbook(workbook, fileName) {
  const output = await SpreadsheetFile.exportXlsx(workbook)
  const stagingDir = '/private/tmp/committee-workbook-build'
  await fs.mkdir(stagingDir, { recursive: true })
  const staged = path.join(stagingDir, fileName)
  await output.save(staged)
  const target = path.join(outputDir, fileName)
  await fs.copyFile(staged, target)
  console.log(target)
}

async function buildDecisionMatrix() {
  const workbook = Workbook.create()
  addInstructionSheet(workbook, 'مصفوفة متابعة القرارات', 'سجل حي للقرارات والتكليفات ومواعيدها وأدلة إقفالها.', [['مرجع الاجتماع', '[رقم/تاريخ]']],
    ['سجل القرار بصياغة تنفيذية واضحة.', 'عيّن مسؤولًا وموعدًا ودليل إقفال.', 'حدّث الحالة والنسبة دوريًا.', 'لا تغلق القرار قبل التحقق من الدليل.'],
    ['لا يوجد قرار بلا مسؤول وموعد.', 'النسبة متسقة مع الحالة.', 'دليل الإقفال قابل للوصول وفق الصلاحية.'])
  const sheet = workbook.worksheets.add('القرارات')
  configureSheet(sheet)
  titleBlock(sheet, 'مصفوفة متابعة القرارات', 'الحالة الزمنية لا تعني التسليم؛ الإقفال يعتمد على الدليل والتحقق.', 'K')
  const headers = ['رقم', 'نص القرار/التكليف', 'المصدر', 'المسؤول', 'تاريخ القرار', 'الموعد', 'الحالة', 'نسبة الإنجاز', 'الأيام المتبقية', 'دليل الإقفال', 'ملاحظة المراجع']
  sheet.getRange('A4:K4').values = [headers]
  styleHeader(sheet, 'A4:K4')
  styleBody(sheet, 'A5:K204')
  sheet.getRange('A5:A204').formulasR1C1 = [['=IF(RC[1]="","",ROW()-4)']]
  sheet.getRange('A5:A204').fillDown()
  sheet.getRange('I5').formulas = [['=IF(F5="","",F5-TODAY())']]
  sheet.getRange('I5:I204').fillDown()
  sheet.getRange('E5:F204').format.numberFormat = 'yyyy-mm-dd'
  sheet.getRange('H5:H204').format.numberFormat = '0%'
  sheet.getRange('G5:G204').dataValidation = { rule: { type: 'list', values: ['لم يبدأ', 'قيد التنفيذ', 'بانتظار المراجعة', 'مغلق', 'موقوف'] } }
  sheet.getRange('H5:H204').dataValidation = { rule: { type: 'decimal', operator: 'between', formula1: 0, formula2: 1 } }
  sheet.getRange('G5:G204').conditionalFormats.add('containsText', { text: 'مغلق', format: { fill: COLORS.mint, font: { color: COLORS.green, bold: true } } })
  sheet.getRange('I5:I204').conditionalFormats.add('cellIs', { operator: 'lessThan', formula: 0, format: { fill: COLORS.redLight, font: { color: COLORS.red, bold: true } } })
  sheet.getRange('A5:A204').format.horizontalAlignment = 'center'
  sheet.getRange('E5:I204').format.horizontalAlignment = 'center'
  setWidths(sheet, { A: 7, B: 34, C: 18, D: 18, E: 14, F: 14, G: 19, H: 14, I: 15, J: 28, K: 28 })
  sheet.freezePanes.freezeRows(4)

  const summary = workbook.worksheets.add('الملخص')
  configureSheet(summary)
  titleBlock(summary, 'ملخص القرارات', 'يتحدث تلقائيًا من ورقة القرارات ولا يمثل نسبة تسليم SharePoint.', 'D')
  summary.getRange('A5:B10').values = [['المؤشر', 'القيمة'], ['إجمالي القرارات', ''], ['لم يبدأ', ''], ['قيد التنفيذ', ''], ['بانتظار المراجعة', ''], ['مغلق', '']]
  styleHeader(summary, 'A5:B5')
  styleBody(summary, 'A6:B10')
  summary.getRange('B6:B10').formulas = [
    ["=COUNTA('القرارات'!B5:B204)"], ["=COUNTIF('القرارات'!G5:G204,\"لم يبدأ\")"], ["=COUNTIF('القرارات'!G5:G204,\"قيد التنفيذ\")"],
    ["=COUNTIF('القرارات'!G5:G204,\"بانتظار المراجعة\")"], ["=COUNTIF('القرارات'!G5:G204,\"مغلق\")"],
  ]
  summary.getRange('B6:B10').format = { font: { ...BASE_FONT, size: 15, bold: true, color: COLORS.green }, horizontalAlignment: 'center' }
  setWidths(summary, { A: 30, B: 18, C: 4, D: 4 })
  await saveWorkbook(workbook, 'مصفوفة_متابعة_القرارات.xlsx')
}

async function buildQualityChecklist() {
  const workbook = Workbook.create()
  addInstructionSheet(workbook, 'قائمة فحص جودة الملف', 'تقييم موزون للاكتمال والموثوقية والتحليل والتحسين والاعتماد.', [],
    ['اقرأ الملف كاملًا وحدد نطاق المراجعة.', 'امنح كل معيار درجة 0–5 مع شاهد.', 'راجع مجموع الأوزان والنتيجة الموزونة.', 'سجل قرار الاعتماد والتحسينات المطلوبة.'],
    ['مجموع الأوزان 100%.', 'كل درجة لها مبرر أو شاهد.', 'قرار الاعتماد متسق مع النتيجة.'])
  const sheet = workbook.worksheets.add('الفحص')
  configureSheet(sheet)
  titleBlock(sheet, 'قائمة فحص جودة الملف', 'الدرجة: 0 غير متحقق، 5 متحقق بالكامل. لا تعتمد نتيجة بلا شاهد.', 'H')
  sheet.getRange('A4:H4').values = [['#', 'المجال', 'المعيار', 'الوزن', 'الدرجة 0–5', 'النتيجة الموزونة', 'الشاهد/الموضع', 'الملاحظة والإجراء']]
  styleHeader(sheet, 'A4:H4')
  const criteria = [
    ['اكتمال', 'الهوية والنطاق والمسؤول والتاريخ مكتملة', 0.10], ['اكتمال', 'المخرج يطابق التكليف والقالب المطلوب', 0.10],
    ['موثوقية', 'المصادر أصلية ومؤرخة وقابلة للتحقق', 0.12], ['موثوقية', 'الأرقام والتواريخ متسقة', 0.08],
    ['تحليل', 'النتائج تتجاوز الوصف وتفسر الفجوات', 0.14], ['تحليل', 'ذُكرت حدود البيانات وعدم اليقين', 0.06],
    ['تحسين', 'التوصيات محددة وقابلة للقياس', 0.10], ['تحسين', 'لكل إجراء مسؤول وموعد ودليل إقفال', 0.10],
    ['حوكمة', 'الاعتماد والصلاحيات موثقة', 0.10], ['قابلية الاستشهاد', 'اسم الملف ومساره وصلة الدراسة الذاتية واضحة', 0.10],
  ]
  const rows = criteria.map((item, index) => [index + 1, item[0], item[1], item[2], '', '', '', ''])
  sheet.getRange('A5:H14').values = rows
  styleBody(sheet, 'A5:H14')
  sheet.getRange('F5').formulas = [['=IF(E5="","",D5*E5/5)']]
  sheet.getRange('F5:F14').fillDown()
  sheet.getRange('D5:D14').format.numberFormat = '0%'
  sheet.getRange('F5:F14').format.numberFormat = '0.0%'
  sheet.getRange('E5:E14').dataValidation = { rule: { type: 'whole', operator: 'between', formula1: 0, formula2: 5 } }
  sheet.getRange('E5:E14').conditionalFormats.add('colorScale', { colors: [COLORS.red, COLORS.gold, COLORS.green], thresholds: ['min', '50%', 'max'] })
  sheet.getRange('A16:C18').values = [['المؤشر', 'القيمة', 'الحكم'], ['مجموع الأوزان', '', ''], ['النتيجة الكلية', '', '']]
  styleHeader(sheet, 'A16:C16')
  styleBody(sheet, 'A17:C18')
  sheet.getRange('B17').formulas = [['=SUM(D5:D14)']]
  sheet.getRange('B18').formulas = [['=SUM(F5:F14)']]
  sheet.getRange('C17').formulas = [['=IF(ABS(B17-1)<0.0001,"سليم","راجع الأوزان")']]
  sheet.getRange('C18').formulas = [['=IF(B18="","",IF(B18>=0.8,"جاهز للاعتماد",IF(B18>=0.6,"يحتاج تحسينًا","يعاد الإعداد")))']]
  sheet.getRange('B17:B18').format.numberFormat = '0.0%'
  setWidths(sheet, { A: 6, B: 16, C: 40, D: 11, E: 13, F: 16, G: 29, H: 34 })
  sheet.freezePanes.freezeRows(4)
  await saveWorkbook(workbook, 'قائمة_فحص_جودة_الملف.xlsx')
}

async function buildPlanReview() {
  const workbook = Workbook.create()
  addInstructionSheet(workbook, 'نموذج فحص الخطط العلمية', 'فحص مستقل لكل خطة علمية بمعيار موحد وملاحظة قابلة للإقفال.', [['مجال الخطة', 'قراءات / دراسات قرآنية / فقه / أصول فقه']],
    ['سجل بيانات الخطة ونسختها.', 'افحص كل بند وسجل موضع الملاحظة.', 'حدد الإجراء والمسؤول والموعد.', 'تحقق من النسخة المعدلة قبل الإقفال.'],
    ['لا تدمج لجان الخطط العلمية الأربع.', 'كل ملاحظة مرتبطة بموضع وتعليل.', 'الإقفال مبني على نسخة معدلة موثقة.'])
  const sheet = workbook.worksheets.add('فحص الخطة')
  configureSheet(sheet)
  titleBlock(sheet, 'نموذج فحص الخطط العلمية', 'يُستخدم لكل لجنة تخصصية مستقلة؛ لا يعد حكمًا نهائيًا قبل الاعتماد.', 'J')
  sheet.getRange('A4:J4').values = [['#', 'المجال', 'البند/المعيار', 'الحكم', 'الدرجة 0–3', 'موضع الملاحظة', 'الملاحظة المعللة', 'الإجراء المطلوب', 'حالة المعالجة', 'مرجع التحقق']]
  styleHeader(sheet, 'A4:J4')
  const criteria = [
    ['هوية الخطة', 'اسم البرنامج والدرجة والجهة والنسخة'], ['بنية الخطة', 'تسلسل المستويات والمتطلبات واضح'],
    ['المقررات', 'الرموز والمسميات والساعات متسقة'], ['المتطلبات', 'السابقة والمتزامنة منطقية'],
    ['نواتج التعلم', 'الربط بين المقررات والنواتج ظاهر'], ['التوازن', 'توزيع الساعات والمتطلبات متوازن'],
    ['المرجعية', 'التعديلات مدعومة بمرجع أو مقارنة'], ['الملاحظات السابقة', 'استجابات المراجعات السابقة موثقة'],
    ['الاعتماد', 'مسار الاعتماد والإصدار محددان'], ['القابلية للتنفيذ', 'العبء والموارد والجداول قابلة للتنفيذ'],
  ]
  sheet.getRange('A5:J14').values = criteria.map((item, index) => [index + 1, item[0], item[1], '', '', '', '', '', '', ''])
  styleBody(sheet, 'A5:J14')
  sheet.getRange('D5:D14').dataValidation = { rule: { type: 'list', values: ['متحقق', 'متحقق جزئيًا', 'غير متحقق', 'لا ينطبق'] } }
  sheet.getRange('E5:E14').dataValidation = { rule: { type: 'whole', operator: 'between', formula1: 0, formula2: 3 } }
  sheet.getRange('I5:I14').dataValidation = { rule: { type: 'list', values: ['مفتوحة', 'قيد المعالجة', 'مغلقة', 'لا ينطبق'] } }
  sheet.getRange('A16:B19').values = [['الملخص', 'القيمة'], ['متطلبات غير متحققة', ''], ['ملاحظات مفتوحة', ''], ['متوسط الدرجة', '']]
  styleHeader(sheet, 'A16:B16')
  styleBody(sheet, 'A17:B19')
  sheet.getRange('B17:B19').formulas = [['=COUNTIF(D5:D14,"غير متحقق")'], ['=COUNTIF(I5:I14,"مفتوحة")'], ['=IFERROR(AVERAGE(E5:E14),"")']]
  sheet.getRange('B19').format.numberFormat = '0.0'
  setWidths(sheet, { A: 6, B: 18, C: 34, D: 18, E: 13, F: 22, G: 36, H: 31, I: 18, J: 25 })
  sheet.freezePanes.freezeRows(4)
  await saveWorkbook(workbook, 'نموذج_فحص_الخطط_العلمية.xlsx')
}

async function buildKpiTracker() {
  const workbook = Workbook.create()
  addInstructionSheet(workbook, 'تقرير متابعة مؤشرات الأداء', 'تعريف المؤشر، قيمته، مصدره، مستهدفه، تحليله وإجراء التحسين.', [],
    ['عرّف المؤشر ومعادلته ومصدره قبل إدخال القيمة.', 'أدخل البسط والمقام أو القيمة المباشرة.', 'قارن بالمستهدف وفسر الفرق.', 'اربط إجراء التحسين بمالك وموعد.'],
    ['التعريف ثابت عبر الفترات.', 'المصدر موثق ويمكن إعادة الحساب منه.', 'النتيجة لا تُعرض بلا تحليل وحدود.'])
  const sheet = workbook.worksheets.add('المؤشرات')
  configureSheet(sheet)
  titleBlock(sheet, 'تقرير متابعة مؤشرات الأداء', 'استخدم خانتي البسط والمقام للنسب؛ واترك المقام فارغًا للقيمة المباشرة.', 'N')
  sheet.getRange('A4:N4').values = [['رمز', 'اسم المؤشر', 'التعريف/المعادلة', 'الفترة', 'البسط/القيمة', 'المقام', 'النتيجة', 'خط الأساس', 'المستهدف', 'الفرق', 'اتجاه الأفضل', 'الحكم', 'المصدر', 'التحليل/الإجراء']]
  styleHeader(sheet, 'A4:N4')
  styleBody(sheet, 'A5:N104')
  sheet.getRange('G5').formulas = [['=IF(E5="","",IF(F5="",E5,IFERROR(E5/F5,"")))']]
  sheet.getRange('G5:G104').fillDown()
  sheet.getRange('J5').formulas = [['=IF(OR(G5="",I5=""),"",G5-I5)']]
  sheet.getRange('J5:J104').fillDown()
  sheet.getRange('L5').formulas = [['=IF(OR(G5="",I5="",K5=""),"",IF(K5="أعلى أفضل",IF(G5>=I5,"متحقق","دون المستهدف"),IF(G5<=I5,"متحقق","فوق الحد")))']]
  sheet.getRange('L5:L104').fillDown()
  sheet.getRange('K5:K104').dataValidation = { rule: { type: 'list', values: ['أعلى أفضل', 'أقل أفضل'] } }
  sheet.getRange('G5:J104').format.numberFormat = '0.0%'
  sheet.getRange('L5:L104').conditionalFormats.add('containsText', { text: 'متحقق', format: { fill: COLORS.mint, font: { color: COLORS.green, bold: true } } })
  sheet.getRange('L5:L104').conditionalFormats.add('containsText', { text: 'المستهدف', format: { fill: COLORS.redLight, font: { color: COLORS.red } } })
  setWidths(sheet, { A: 11, B: 25, C: 34, D: 14, E: 14, F: 12, G: 13, H: 14, I: 14, J: 12, K: 16, L: 18, M: 25, N: 40 })
  sheet.freezePanes.freezeRows(4)

  const summary = workbook.worksheets.add('الملخص')
  configureSheet(summary)
  titleBlock(summary, 'ملخص المؤشرات', 'قراءة آلية من ورقة المؤشرات؛ يجب مراجعة التعريف والمصدر قبل الاستشهاد.', 'D')
  summary.getRange('A5:B8').values = [['المؤشر', 'القيمة'], ['مؤشرات مدخلة', ''], ['متحقق', ''], ['بحاجة تدخل', '']]
  styleHeader(summary, 'A5:B5')
  styleBody(summary, 'A6:B8')
  summary.getRange('B6:B8').formulas = [["=COUNTA('المؤشرات'!B5:B104)"], ["=COUNTIF('المؤشرات'!L5:L104,\"متحقق\")"], ["=COUNTIF('المؤشرات'!L5:L104,\"<>متحقق\")-COUNTBLANK('المؤشرات'!L5:L104)"]]
  setWidths(summary, { A: 28, B: 18, C: 4, D: 4 })
  await saveWorkbook(workbook, 'تقرير_متابعة_مؤشرات_الأداء.xlsx')
}

async function buildSurveyAnalysis() {
  const workbook = Workbook.create()
  addInstructionSheet(workbook, 'تقرير تحليل نتائج استبانة', 'إدخال استجابات رقمية مجهولة وتحليلها مع قيود الاستجابة والتوصيات.', [['مقياس الإجابة', '1 لا أوافق بشدة … 5 أوافق بشدة']],
    ['اكتب نصوص الأسئلة في ورقة التحليل.', 'أدخل استجابات مجهولة بلا أسماء أو بيانات اتصال.', 'راجع المتوسط ونسبة الرضا وحجم الاستجابة.', 'حلل القيود والتعليقات ثم ضع تحسينًا.'],
    ['لا توجد معرفات شخصية غير لازمة.', 'عدد الاستجابات موضح لكل سؤال.', 'الاستنتاج متناسب مع حجم العينة ومعدل الاستجابة.'])
  const responses = workbook.worksheets.add('الاستجابات')
  configureSheet(responses)
  titleBlock(responses, 'الاستجابات المجهولة', 'لا تسجل الاسم أو البريد أو الهاتف. استخدم رمز استجابة عشوائيًا عند الحاجة.', 'G')
  responses.getRange('A4:G4').values = [['رمز مجهول', 'تاريخ الاستجابة', 'السؤال 1', 'السؤال 2', 'السؤال 3', 'السؤال 4', 'تعليق اختياري منقح']]
  styleHeader(responses, 'A4:G4')
  styleBody(responses, 'A5:G504')
  responses.getRange('B5:B504').format.numberFormat = 'yyyy-mm-dd'
  responses.getRange('C5:F504').dataValidation = { rule: { type: 'whole', operator: 'between', formula1: 1, formula2: 5 } }
  setWidths(responses, { A: 16, B: 16, C: 15, D: 15, E: 15, F: 15, G: 50 })
  responses.freezePanes.freezeRows(4)

  const analysis = workbook.worksheets.add('التحليل')
  configureSheet(analysis)
  titleBlock(analysis, 'تحليل نتائج الاستبانة', 'عرّف الأسئلة وأهدافها ثم فسّر الأرقام وحدودها.', 'H')
  analysis.getRange('A4:H4').values = [['#', 'نص السؤال', 'الهدف/المحور', 'عدد الاستجابات', 'المتوسط', 'نسبة الرضا 4–5', 'الحكم', 'التفسير/التحسين']]
  styleHeader(analysis, 'A4:H4')
  analysis.getRange('A5:C8').values = [[1, '[نص السؤال 1]', '[محور]'], [2, '[نص السؤال 2]', '[محور]'], [3, '[نص السؤال 3]', '[محور]'], [4, '[نص السؤال 4]', '[محور]']]
  styleBody(analysis, 'A5:H8')
  const cols = ['C', 'D', 'E', 'F']
  for (let idx = 0; idx < 4; idx += 1) {
    const row = 5 + idx
    const col = cols[idx]
    analysis.getRange(`D${row}`).formulas = [[`=COUNT('الاستجابات'!${col}5:${col}504)`]]
    analysis.getRange(`E${row}`).formulas = [[`=IFERROR(AVERAGE('الاستجابات'!${col}5:${col}504),"")`]]
    analysis.getRange(`F${row}`).formulas = [[`=IFERROR(COUNTIF('الاستجابات'!${col}5:${col}504,">=4")/COUNT('الاستجابات'!${col}5:${col}504),"")`]]
    analysis.getRange(`G${row}`).formulas = [[`=IF(F${row}="","",IF(F${row}>=0.8,"مرتفع",IF(F${row}>=0.6,"متوسط","أولوية تحسين")))`]]
  }
  analysis.getRange('E5:E8').format.numberFormat = '0.00'
  analysis.getRange('F5:F8').format.numberFormat = '0.0%'
  analysis.getRange('A10:B14').values = [['عنصر التفسير', 'التوثيق'], ['عدد المدعوين', '[عدد]'], ['عدد المستجيبين', ''], ['معدل الاستجابة', ''], ['قيود التحليل', '[تحيز عدم الاستجابة/حجم العينة/صياغة السؤال]']]
  styleHeader(analysis, 'A10:B10')
  styleBody(analysis, 'A11:B14')
  analysis.getRange('B12').formulas = [["=COUNTA('الاستجابات'!A5:A504)"]]
  analysis.getRange('B13').formulas = [['=IFERROR(B12/B11,"")']]
  analysis.getRange('B13').format.numberFormat = '0.0%'
  setWidths(analysis, { A: 7, B: 36, C: 20, D: 15, E: 12, F: 17, G: 18, H: 44 })
  analysis.freezePanes.freezeRows(4)
  await saveWorkbook(workbook, 'تقرير_تحليل_نتائج_استبانة.xlsx')
}

async function buildEvidenceRegister() {
  const workbook = Workbook.create()
  addInstructionSheet(workbook, 'سجل الأدلة والمرفقات', 'فهرس يربط كل دليل بالمهمة والمعيار والمالك ومكان الحفظ وحالة المراجعة.', [],
    ['سمّ الدليل وفق القاعدة الموحدة.', 'حدد ما يثبته وصلته بالمهمة أو المحك.', 'سجل مسارًا داخليًا مقيدًا ومالكًا.', 'راجع الصلاحية والنسخة ثم حدّث الحالة.'],
    ['لا توجد روابط عامة أو بيانات شخصية غير لازمة.', 'لكل دليل تاريخ ومالك ونسخة.', 'العلاقة بين الدليل والادعاء مكتوبة بوضوح.'])
  const sheet = workbook.worksheets.add('سجل الأدلة')
  configureSheet(sheet)
  titleBlock(sheet, 'سجل الأدلة والمرفقات', 'المسار المقترح تنظيمي حتى اعتماد مسؤول SharePoint؛ لا يعد الرابط وحده دليلًا صالحًا.', 'M')
  sheet.getRange('A4:M4').values = [['رقم الدليل', 'اسم الملف الموحد', 'العنوان', 'الفئة', 'القسم', 'اللجنة', 'رمز المهمة', 'المعيار/المحك', 'تاريخ الدليل', 'المالك', 'مرجع الحفظ الداخلي', 'تصنيف الوصول', 'حالة المراجعة']]
  styleHeader(sheet, 'A4:M4')
  styleBody(sheet, 'A5:M304')
  sheet.getRange('D5:D304').dataValidation = { rule: { type: 'list', values: ['محضر', 'خطة', 'تقرير', 'سجل', 'تحليل', 'اعتماد', 'مرفق داعم'] } }
  sheet.getRange('L5:L304').dataValidation = { rule: { type: 'list', values: ['داخلي', 'مقيد', 'سري'] } }
  sheet.getRange('M5:M304').dataValidation = { rule: { type: 'list', values: ['لم يراجع', 'قيد المراجعة', 'مقبول', 'يحتاج تحديثًا', 'مستبدل'] } }
  sheet.getRange('I5:I304').format.numberFormat = 'yyyy-mm-dd'
  sheet.getRange('M5:M304').conditionalFormats.add('containsText', { text: 'مقبول', format: { fill: COLORS.mint, font: { color: COLORS.green, bold: true } } })
  sheet.getRange('M5:M304').conditionalFormats.add('containsText', { text: 'تحديث', format: { fill: COLORS.goldLight, font: { color: COLORS.gold, bold: true } } })
  setWidths(sheet, { A: 14, B: 43, C: 28, D: 17, E: 18, F: 25, G: 14, H: 18, I: 14, J: 18, K: 40, L: 15, M: 18 })
  sheet.freezePanes.freezeRows(4)

  const summary = workbook.worksheets.add('الملخص')
  configureSheet(summary)
  titleBlock(summary, 'ملخص سجل الأدلة', 'مؤشرات اكتمال السجل؛ صلاحية الاستشهاد تتطلب مراجعة محتوى الدليل.', 'D')
  summary.getRange('A5:B9').values = [['المؤشر', 'القيمة'], ['إجمالي الأدلة', ''], ['مقبول', ''], ['يحتاج تحديثًا', ''], ['بلا مرجع حفظ', '']]
  styleHeader(summary, 'A5:B5')
  styleBody(summary, 'A6:B9')
  summary.getRange('B6:B9').formulas = [['=COUNTA(\'سجل الأدلة\'!C5:C304)'], ['=COUNTIF(\'سجل الأدلة\'!M5:M304,"مقبول")'], ['=COUNTIF(\'سجل الأدلة\'!M5:M304,"يحتاج تحديثًا")'], ['=COUNTIFS(\'سجل الأدلة\'!C5:C304,"<>",\'سجل الأدلة\'!K5:K304,"")']]
  setWidths(summary, { A: 30, B: 18, C: 4, D: 4 })
  await saveWorkbook(workbook, 'سجل_الأدلة_والمرفقات.xlsx')
}

async function buildSchedulePlanner() {
  const workbook = Workbook.create()
  addInstructionSheet(workbook, 'نموذج إعداد ومراجعة الجدول الدراسي', 'تخطيط الشعب والأوقات والقاعات وفحص التعارضات قبل الاعتماد.', [],
    ['أدخل كل شعبة في صف مستقل.', 'استخدم رموزًا ثابتة للأيام والقاعات.', 'راجع تنبيه التعارض ثم معالجة السبب.', 'نفذ قائمة الجاهزية واعتمد النسخة.'],
    ['لا توجد شعبة بلا مقرر ووقت وقاعة.', 'كل تعارض مفسر أو معالج.', 'النسخة والتاريخ والاعتماد موثقة.'])
  const sheet = workbook.worksheets.add('الجدول')
  configureSheet(sheet)
  titleBlock(sheet, 'إعداد الجدول الدراسي', 'وقت البداية والنهاية بصيغة 24 ساعة. عمود التعارض تنبيه مساعد ويستلزم مراجعة بشرية.', 'L')
  sheet.getRange('A4:L4').values = [['#', 'رمز المقرر', 'اسم المقرر', 'المستوى', 'الشعبة', 'اليوم', 'البداية', 'النهاية', 'القاعة', 'المكلف/الدور', 'تنبيه التعارض', 'الملاحظة']]
  styleHeader(sheet, 'A4:L4')
  styleBody(sheet, 'A5:L204')
  sheet.getRange('A5').formulas = [['=IF(B5="","",ROW()-4)']]
  sheet.getRange('A5:A204').fillDown()
  sheet.getRange('K5').formulas = [['=IF(OR(F5="",G5="",H5=""),"",IF(COUNTIFS($F$5:$F$204,F5,$I$5:$I$204,I5,$G$5:$G$204,"<"&H5,$H$5:$H$204,">"&G5)>1,"تعارض قاعة",IF(COUNTIFS($F$5:$F$204,F5,$J$5:$J$204,J5,$G$5:$G$204,"<"&H5,$H$5:$H$204,">"&G5)>1,"تعارض تكليف","سليم")))']]
  sheet.getRange('K5:K204').fillDown()
  sheet.getRange('F5:F204').dataValidation = { rule: { type: 'list', values: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'] } }
  sheet.getRange('G5:H204').format.numberFormat = 'hh:mm'
  sheet.getRange('K5:K204').conditionalFormats.add('containsText', { text: 'تعارض', format: { fill: COLORS.redLight, font: { color: COLORS.red, bold: true } } })
  sheet.getRange('K5:K204').conditionalFormats.add('containsText', { text: 'سليم', format: { fill: COLORS.mint, font: { color: COLORS.green } } })
  setWidths(sheet, { A: 6, B: 15, C: 29, D: 10, E: 10, F: 13, G: 12, H: 12, I: 14, J: 22, K: 18, L: 31 })
  sheet.freezePanes.freezeRows(4)

  const review = workbook.worksheets.add('قائمة المراجعة')
  configureSheet(review)
  titleBlock(review, 'قائمة مراجعة الجدول', 'يستكملها مقرر اللجنة ثم يعتمدها صاحب الصلاحية.', 'F')
  review.getRange('A4:F4').values = [['#', 'محور المراجعة', 'الضابط', 'النتيجة', 'الملاحظة', 'مرجع المعالجة']]
  styleHeader(review, 'A4:F4')
  const checks = [
    ['اكتمال', 'جميع المقررات والشعب مدرجة'], ['تعارضات', 'لا يوجد تعارض قاعة أو تكليف'], ['توزيع', 'الأوقات موزعة بصورة قابلة للتنفيذ'],
    ['متطلبات', 'المتطلبات السابقة والمتزامنة روعيت'], ['موارد', 'القاعات والموارد مناسبة'], ['حوكمة', 'النسخة راجعها واعتمدها صاحب الصلاحية'],
  ]
  review.getRange('A5:F10').values = checks.map((item, index) => [index + 1, item[0], item[1], '', '', ''])
  styleBody(review, 'A5:F10')
  review.getRange('D5:D10').dataValidation = { rule: { type: 'list', values: ['متحقق', 'جزئي', 'غير متحقق', 'لا ينطبق'] } }
  setWidths(review, { A: 7, B: 18, C: 42, D: 18, E: 34, F: 28 })
  await saveWorkbook(workbook, 'نموذج_إعداد_ومراجعة_الجدول_الدراسي.xlsx')
}

async function buildExamReadiness() {
  const workbook = Workbook.create()
  addInstructionSheet(workbook, 'قائمة جاهزية الاختبارات', 'متابعة جاهزية الاختبارات من التخطيط حتى حفظ النتائج والأدلة.', [],
    ['راجع البنود حسب المرحلة والتاريخ المطلوب.', 'عيّن مالكًا وسجل الدليل لكل بند.', 'صعّد البنود الحرجة المتأخرة وفق الصلاحية.', 'وثق المعالجة والاعتماد النهائي.'],
    ['لا توجد حالة «مكتمل» بلا دليل.', 'حفظت السرية ولم تسجل بيانات طلاب في هذا السجل.', 'فُصلت الجاهزية عن التنفيذ الفعلي والنتائج.'])
  const sheet = workbook.worksheets.add('الجاهزية')
  configureSheet(sheet)
  titleBlock(sheet, 'قائمة جاهزية الاختبارات', 'سجل تشغيلي بلا أسماء طلاب أو أرقام جامعية. الحالة تثبت بالدليل، لا بالتاريخ وحده.', 'I')
  sheet.getRange('A4:I4').values = [['#', 'المرحلة', 'متطلب الجاهزية', 'المالك', 'التاريخ المطلوب', 'الحالة', 'الأولوية', 'الدليل/المرجع', 'الملاحظة والمعالجة']]
  styleHeader(sheet, 'A4:I4')
  const items = [
    ['التخطيط', 'اعتماد جدول الاختبارات وتعارضاته'], ['التخطيط', 'تحديد الاحتياج من القاعات والمراقبة'],
    ['الإعداد', 'مراجعة مواصفات الاختبار وتغطية النواتج'], ['الإعداد', 'تسليم النسخ وفق قناة آمنة'],
    ['التنفيذ', 'جاهزية القاعات والتعليمات والحالات الطارئة'], ['التنفيذ', 'توثيق الوقائع دون بيانات حساسة في السجل العام'],
    ['ما بعد الاختبار', 'رصد النتائج والتحقق المزدوج'], ['ما بعد الاختبار', 'تحليل النتائج ومؤشرات الصعوبة'],
    ['الإقفال', 'حفظ الأدلة والاعتماد وفق الصلاحية'], ['الإقفال', 'تسجيل التحسينات للدورة التالية'],
  ]
  sheet.getRange('A5:I14').values = items.map((item, index) => [index + 1, item[0], item[1], '', '', '', '', '', ''])
  styleBody(sheet, 'A5:I14')
  sheet.getRange('E5:E14').format.numberFormat = 'yyyy-mm-dd'
  sheet.getRange('F5:F14').dataValidation = { rule: { type: 'list', values: ['لم يبدأ', 'قيد التنفيذ', 'بانتظار التحقق', 'مكتمل', 'متعثر'] } }
  sheet.getRange('G5:G14').dataValidation = { rule: { type: 'list', values: ['حرجة', 'عالية', 'متوسطة', 'منخفضة'] } }
  sheet.getRange('F5:F14').conditionalFormats.add('containsText', { text: 'مكتمل', format: { fill: COLORS.mint, font: { color: COLORS.green, bold: true } } })
  sheet.getRange('F5:F14').conditionalFormats.add('containsText', { text: 'متعثر', format: { fill: COLORS.redLight, font: { color: COLORS.red, bold: true } } })
  sheet.getRange('A16:B20').values = [['الملخص', 'القيمة'], ['إجمالي البنود', ''], ['مكتمل', ''], ['متعثر', ''], ['بانتظار التحقق', '']]
  styleHeader(sheet, 'A16:B16')
  styleBody(sheet, 'A17:B20')
  sheet.getRange('B17:B20').formulas = [['=COUNTA(C5:C14)'], ['=COUNTIF(F5:F14,"مكتمل")'], ['=COUNTIF(F5:F14,"متعثر")'], ['=COUNTIF(F5:F14,"بانتظار التحقق")']]
  setWidths(sheet, { A: 6, B: 18, C: 41, D: 18, E: 16, F: 19, G: 14, H: 31, I: 38 })
  sheet.freezePanes.freezeRows(4)
  await saveWorkbook(workbook, 'قائمة_جاهزية_الاختبارات.xlsx')
}

await buildDecisionMatrix()
await buildQualityChecklist()
await buildPlanReview()
await buildKpiTracker()
await buildSurveyAnalysis()
await buildEvidenceRegister()
await buildSchedulePlanner()
await buildExamReadiness()
