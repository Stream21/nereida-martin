import { motion } from 'framer-motion'
import useScrollReveal from '../../hooks/useScrollReveal'
import Icon from '../ui/Icon'

const features = [
  {
    icon: 'auto_awesome',
    title: '+10 años de experiencia',
    text: 'Una trayectoria dedicada al mundo de la belleza, con un enfoque en el detalle y la naturalidad.',
  },
  {
    icon: 'school',
    title: '+20 formaciones especializadas',
    text: 'En constante aprendizaje con diferentes profesionales del sector para ofrecer siempre lo mejor.',
  },
  {
    icon: 'favorite',
    title: 'Enfoque personalizado',
    text: 'Cada rostro es único. Trabajo respetando tu forma natural, tu expresión y tu esencia.',
  },
]

function RevealBlock({ children, delay = 0 }) {
  const { ref, isInView, variants } = useScrollReveal()
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={variants}
      transition={{ duration: 0.7, ease: 'easeOut', delay }}
      className="will-change-transform"
    >
      {children}
    </motion.div>
  )
}

export default function AboutSection() {
  return (
    <section id="about" className="py-24 px-6 bg-surface-container-low overflow-hidden">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">
        <RevealBlock>
          <div className="relative flex items-center justify-center">
            <div className="w-[340px] h-[340px] md:w-[420px] md:h-[420px] rounded-full overflow-hidden mx-auto drop-shadow-xl">
              <img
                src="/nereida-sobre-mi.png"
                alt="Nereida Martín"
                loading="lazy"
                decoding="async"
                width={600}
                height={600}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </RevealBlock>

        <div>
          <RevealBlock delay={0.1}>
            <span className="font-label text-xs tracking-[0.3em] uppercase text-primary font-bold mb-4 block">
              Sobre mí
            </span>
          </RevealBlock>

          <RevealBlock delay={0.2}>
            <h2 className="font-headline text-4xl mb-6 text-on-surface">Nereida Martín</h2>
          </RevealBlock>

          <RevealBlock delay={0.3}>
            <div className="w-16 h-[2px] bg-primary/40 mb-8" />
          </RevealBlock>

          <RevealBlock delay={0.35}>
            <p className="font-body text-on-surface-variant leading-relaxed mb-4 text-base">
              Mi nombre es Nereida y soy especialista en cejas, con más de 10 años de experiencia en el mundo de la belleza.
            </p>
          </RevealBlock>

          <RevealBlock delay={0.4}>
            <p className="font-body text-on-surface-variant leading-relaxed mb-4 text-base">
              Desde el principio tuve claro que no quería que cada cita fuese una simple depilación, sino crear un espacio donde cada persona pudiera desconectar, relajarse y sentirse en confianza. Un lugar cuidado, donde no solo importa el resultado, sino también cómo te sientes durante todo el proceso.
            </p>
          </RevealBlock>

          <RevealBlock delay={0.45}>
            <p className="font-body text-on-surface-variant leading-relaxed mb-4 text-base">
              Mi forma de trabajar se basa en el detalle. Soy una persona perfeccionista, y eso se refleja en cada diseño, en cada ceja y en cada tratamiento que realizo.
            </p>
          </RevealBlock>

          <RevealBlock delay={0.5}>
            <p className="font-body leading-relaxed mb-8 text-base italic text-primary/80">
              Mi objetivo no es cambiar tus cejas, sino realzar lo que ya tienes.
            </p>
          </RevealBlock>

          <div className="space-y-6">
            {features.map((f, i) => (
              <RevealBlock key={f.title} delay={0.55 + i * 0.1}>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full border border-primary/20 flex items-center justify-center shrink-0">
                    <Icon name={f.icon} className="text-primary" />
                  </div>
                  <div>
                    <h4 className="font-headline text-base font-bold mb-1 text-on-surface">{f.title}</h4>
                    <p className="text-sm text-on-surface-variant">{f.text}</p>
                  </div>
                </div>
              </RevealBlock>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
