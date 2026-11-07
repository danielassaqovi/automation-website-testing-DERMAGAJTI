# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.js >> Responsive layout - desktop (1440x900) >> renders without horizontal overflow at 1440x900
- Location: src/tests/responsive.spec.js:19:5

# Error details

```
Error: Horizontal overflow is 360px (tolerance 2px). Possible offenders: []

expect(received).toBeLessThanOrEqual(expected)

Expected: <= 2
Received:    360
```

# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e11]:
    - generic [ref=e12]:
      - img "Logo Polinema" [ref=e14]
      - img "Logo JTI" [ref=e16]
    - generic [ref=e17]:
      - heading "DERMAGA JTI" [level=1] [ref=e18]
      - paragraph [ref=e19]: Sistem Pendaftaran, Monitoring dan Evaluasi Magang JTI
    - generic [ref=e20]:
      - generic [ref=e21]:
        - generic [ref=e22]: Username
        - generic [ref=e23]:
          - generic [ref=e24]: 
          - textbox "Username" [active] [ref=e26]:
            - /placeholder: Masukkan username
      - generic [ref=e27]:
        - generic [ref=e28]: Password
        - generic [ref=e29]:
          - generic [ref=e30]: 
          - textbox "Password" [ref=e32]:
            - /placeholder: Masukkan password
          - button "" [ref=e33] [cursor=pointer]
      - generic [ref=e37]:
        - checkbox "Ingat saya" [ref=e38]
        - generic [ref=e39]: Ingat saya
      - button " Masuk" [ref=e41] [cursor=pointer]:
        - generic [ref=e42]: 
        - text: Masuk
    - generic [ref=e43]:
      - separator [ref=e44]
      - generic [ref=e45]: atau
      - separator [ref=e46]
    - link " Login dengan Google Polinema" [ref=e48] [cursor=pointer]:
      - /url: https://jti.polinema.ac.id/dermaga/sso/google
      - generic [ref=e49]: 
      - text: Login dengan Google Polinema
    - paragraph [ref=e50]: Akun @polinema.ac.id / @student.polinema.ac.id melalui JTI SSO.
  - paragraph [ref=e51]: © 2026 Jurusan Teknologi Informasi — Politeknik Negeri Malang
```

# Test source

```ts
  11  |   test.describe(`Responsive layout - ${viewport.name} (${viewport.width}x${viewport.height})`, () => {
  12  |     test.use({
  13  |       viewport: { width: viewport.width, height: viewport.height },
  14  |       screen: { width: viewport.width, height: viewport.height },
  15  |       hasTouch: viewport.hasTouch,
  16  |       ...(config.browser === 'chromium' ? { isMobile: viewport.isMobile } : {}),
  17  |     });
  18  | 
  19  |     test(`renders without horizontal overflow at ${viewport.width}x${viewport.height}`, async ({
  20  |       page,
  21  |     }, testInfo) => {
  22  |       await gotoTarget(page);
  23  | 
  24  |       const layout = await page.evaluate(() => {
  25  |         const documentElement = document.documentElement;
  26  |         const body = document.body;
  27  |         const clientWidth = documentElement.clientWidth;
  28  |         const scrollWidth = Math.max(documentElement.scrollWidth, body?.scrollWidth || 0);
  29  |         const offenders = [];
  30  | 
  31  |         for (const element of document.querySelectorAll('body *')) {
  32  |           const style = window.getComputedStyle(element);
  33  |           if (style.display === 'none' || style.visibility === 'hidden') continue;
  34  | 
  35  |           const rect = element.getBoundingClientRect();
  36  |           if (rect.width === 0 || rect.height === 0) continue;
  37  | 
  38  |           if (rect.right > clientWidth + 1) {
  39  |             offenders.push({
  40  |               tag: element.tagName.toLowerCase(),
  41  |               id: element.getAttribute('id') || '',
  42  |               className:
  43  |                 typeof element.className === 'string' ? element.className.slice(0, 120) : '',
  44  |               left: Math.round(rect.left),
  45  |               right: Math.round(rect.right),
  46  |               width: Math.round(rect.width),
  47  |             });
  48  |             if (offenders.length >= 8) break;
  49  |           }
  50  |         }
  51  | 
  52  |         const viewportMeta = document.querySelector('meta[name="viewport"]');
  53  |         const bodyRect = body ? body.getBoundingClientRect() : { width: 0, height: 0 };
  54  | 
  55  |         return {
  56  |           clientWidth,
  57  |           scrollWidth,
  58  |           horizontalOverflow: Math.max(0, scrollWidth - clientWidth),
  59  |           offenders,
  60  |           viewportMetaContent: viewportMeta?.getAttribute('content') || null,
  61  |           bodyWidth: Math.round(bodyRect.width),
  62  |           bodyHeight: Math.round(bodyRect.height),
  63  |           devicePixelRatio: window.devicePixelRatio,
  64  |         };
  65  |       });
  66  | 
  67  |       await testInfo.attach('layout-metrics.json', {
  68  |         body: JSON.stringify({ viewport, ...layout }, null, 2),
  69  |         contentType: 'application/json',
  70  |       });
  71  | 
  72  |       ensureDir(config.screenshotsDir);
  73  |       const screenshotPath = path.join(
  74  |         config.screenshotsDir,
  75  |         `responsive-${viewport.name}-${timestamp()}.png`,
  76  |       );
  77  | 
  78  |       try {
  79  |         await page.screenshot({ path: screenshotPath, fullPage: true, timeout: 20000 });
  80  |         await testInfo.attach(`responsive-${viewport.name}`, {
  81  |           path: screenshotPath,
  82  |           contentType: 'image/png',
  83  |         });
  84  |       } catch {
  85  |         testInfo.annotations.push({
  86  |           type: 'screenshot',
  87  |           description: `Could not capture the ${viewport.name} screenshot.`,
  88  |         });
  89  |       }
  90  | 
  91  |       expect(
  92  |         layout.bodyHeight,
  93  |         `The page body is not visible at ${viewport.width}x${viewport.height}.`,
  94  |       ).toBeGreaterThan(0);
  95  | 
  96  |       if (viewport.isMobile) {
  97  |         expect(
  98  |           layout.viewportMetaContent,
  99  |           'The mobile page is missing <meta name="viewport">. Real mobile browsers will scale the page incorrectly.',
  100 |         ).toBeTruthy();
  101 |         expect(
  102 |           /width\s*=\s*device-width/i.test(layout.viewportMetaContent || ''),
  103 |           `The viewport meta tag does not include width=device-width: "${layout.viewportMetaContent}".`,
  104 |         ).toBe(true);
  105 |       }
  106 | 
  107 |       expect(
  108 |         layout.horizontalOverflow,
  109 |         `Horizontal overflow is ${layout.horizontalOverflow}px (tolerance ${config.overflowTolerancePx}px). ` +
  110 |           `Possible offenders: ${JSON.stringify(layout.offenders, null, 2)}`,
> 111 |       ).toBeLessThanOrEqual(config.overflowTolerancePx);
      |         ^ Error: Horizontal overflow is 360px (tolerance 2px). Possible offenders: []
  112 |     });
  113 |   });
  114 | }
  115 | 
```