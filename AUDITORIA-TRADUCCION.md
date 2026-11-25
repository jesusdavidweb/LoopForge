
### Credenciales Git, ejecutores, runners y creación de sandboxes

Playwright volvió a recorrer estos formularios en la instalación local de Dory con el idioma inglés. Revisó autorización GitHub y reintento, introducción y confirmación del token, Git SSH, los tres formularios HTTPS, y todos los ejecutores ofrecidos en la cuenta demo, incluidas sus guías y opciones. En My runners comprobó la ayuda de autenticación, el catálogo vacío y la fila de un modelo nuevo en ambos modos de autenticación. El navegador simuló la disponibilidad de GitHub y el runner. También comprobó ambas variantes de aislamiento en `/#/sandboxes/new`. Las pruebas no guardaron credenciales ni ejecutaron tareas.

### Alta de habilidad, selectores de ejecución y proyecto, y asistente de acceso rápido

La suite de localización cubre ahora la creación de una habilidad en `/#/skills/new` (encabezado, botón de alta y aviso previo a subir archivos), el menú del selector de máquina de ejecución (búsqueda, asignación automática y acciones de administración), el selector de proyecto (conversación personal y alta de proyecto) y el asistente de acceso rápido hasta el resumen de configuración. Las comprobaciones verifican que ninguna de esas superficies conserve texto en chino, incluidos los atributos de accesibilidad.

Los menús del compositor también se revisaron: el de nivel de razonamiento (Default, Low, Medium, High y sus descripciones) y el de modo de aprobación (Ask for approval, Approve for me, Full access y sus descripciones) seguían en chino. Se añadieron sus textos al diccionario y la suite comprueba que ambos menús no conserven caracteres chinos.
