# Bbetia

Calculadora de cobertura con cuotas decimales e historial local. Sitio estático: no requiere compilación ni dependencias para funcionar.

Activá **Incluir equipo que clasifica** para usar las cuotas de resultado y clasificación en el mismo cálculo. Elegí **Mi equipo**, el formato de la eliminatoria y el importe total. El objetivo es mejorar el peor saldo cuando tu equipo **no gana en los 90 minutos y queda eliminado**. Se permite una pérdida hasta el importe total cuando tu equipo **gana o clasifica**; no se exige perder en esos casos.

La cobertura compara la clasificación del rival con repartir entre su triunfo y el empate. Las apuestas al triunfo o clasificación de tu equipo no cobran en los escenarios que se quieren cubrir, por lo que reciben cero. Para un importe fijo, el pago mínimo es una función lineal de la parte asignada a clasificación: el óptimo continuo está en una de esas dos alternativas. Se comparan los importes redondeados a centavos de ambas. Las cuotas pueden hacer que convenga una sola apuesta. No se promete una mejora por mezclar mercados ni optimalidad entera por debajo del redondeo de centavos.

En **Partido único** se muestran cuatro escenarios. En **Ida y vuelta** se muestran conservadoramente las seis combinaciones de resultado y clasificado, sin pedir el global. Algunas pueden ser inviables para un global concreto. Se mantiene literalmente el criterio «gana o clasifica», por lo que ganar el partido y quedar eliminado también permite una pérdida.

El historial guarda la distribución, las cuotas y el saldo de cada escenario al momento de guardar; el cierre usa esa copia. Las apuestas previas y las estrategias Recuperar/Equilibrar continúan disponibles. Los datos siguen guardándose en el mismo navegador.

Validación de cálculos: `node --test tests/coverage.test.cjs`.

Para probar la interfaz: `python3 -m http.server 8000` y abrir `http://localhost:8000`.
