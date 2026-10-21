# Bbetia

Calculadora de cobertura con cuotas decimales e historial local. Sitio estático: no requiere compilación ni dependencias para funcionar.

Activá **Incluir equipo que clasifica** para usar las cuotas de resultado y clasificación en el mismo cálculo. Elegí **Mi equipo**, el formato de la eliminatoria, el importe total y la estrategia. Se permite una pérdida hasta el importe total cuando tu equipo **gana o clasifica**; no se exige perder en esos casos.

**Recuperar** y **Equilibrar** están disponibles con y sin clasificación. En la cobertura conjunta, Recuperar permite elegir el caso en el que se quiere recuperar el total: empate y clasificación del rival o triunfo y clasificación del rival. La selección usa el nombre real del equipo. El cálculo compara las cuotas de resultado y clasificación para cubrir ese caso y obtener una mayor ganancia en el otro, redondeando a centavos. Todas las apuestas simples del reparto se hacen antes del partido; la selección expresa una preferencia de resultado, no una secuencia de apuestas. El resumen muestra cada caso concreto junto a «Recuperás», «Ganás» o «Perdés», sin referencias a un primer o segundo desenlace.

Equilibrar busca el mejor saldo mínimo cuando tu equipo **no gana en los 90 minutos y queda eliminado**. Compara apostar a la clasificación del rival con repartir entre su triunfo y el empate. Las apuestas al triunfo o clasificación de tu equipo no cobran en esos desenlaces y reciben cero. Para un importe fijo, el pago mínimo es una función lineal de la parte asignada a clasificación: el óptimo continuo está en una de esas dos alternativas. Se comparan sus importes redondeados a centavos. Las cuotas pueden hacer que convenga una sola apuesta. No se promete una mejora por mezclar mercados ni optimalidad entera por debajo del redondeo de centavos.

En **Partido único** se muestran cuatro escenarios. En **Ida y vuelta** se muestran conservadoramente las seis combinaciones de resultado y clasificado, sin pedir el global. Algunas pueden ser inviables para un global concreto. Se mantiene literalmente el criterio «gana o clasifica», por lo que ganar el partido y quedar eliminado también permite una pérdida.

El historial guarda la estrategia, la prioridad, la distribución, las cuotas y el saldo de cada escenario al momento de guardar; el cierre usa esa copia. Las apuestas conjuntas anteriores al selector de estrategias se identifican como Equilibrar, que era su cálculo real. Las apuestas previas continúan disponibles. Los datos siguen guardándose en el mismo navegador.

Validación de cálculos: `node --test tests/coverage.test.cjs`.

Para probar la interfaz: `python3 -m http.server 8000` y abrir `http://localhost:8000`.
