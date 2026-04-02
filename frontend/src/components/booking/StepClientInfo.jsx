import { motion } from 'framer-motion'
import Icon from '../ui/Icon'

const fieldVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.1 + i * 0.1, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
}

export default function StepClientInfo({ clientInfo, onChange }) {
  const handleChange = (field) => (e) => {
    onChange({ ...clientInfo, [field]: e.target.value })
  }

  return (
    <div>
      <section className="mb-10 text-center">
        <span className="font-label text-[10px] tracking-[0.2em] uppercase text-primary font-bold block mb-2">
          Paso 3 de 4
        </span>
        <h2 className="font-headline text-3xl md:text-4xl text-on-surface">Tus Datos</h2>
        <p className="mt-3 text-sm text-on-surface-variant max-w-xs mx-auto">
          Necesitamos tus datos de contacto para confirmar la reserva
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <div className="h-[2px] w-8 bg-primary" />
          <div className="h-[2px] w-8 bg-primary" />
          <div className="h-[2px] w-12 bg-primary" />
          <div className="h-[2px] w-8 bg-outline-variant/30" />
        </div>
      </section>

      <div className="space-y-5">
        <motion.div
          custom={0}
          variants={fieldVariants}
          initial="hidden"
          animate="visible"
        >
          <label className="block mb-2">
            <span className="text-[10px] font-label font-bold tracking-[0.15em] uppercase text-on-surface-variant">
              Nombre completo
            </span>
          </label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <Icon name="person" className="text-primary/60 text-lg" />
            </div>
            <input
              type="text"
              value={clientInfo.name}
              onChange={handleChange('name')}
              placeholder="Tu nombre y apellidos"
              autoComplete="name"
              className="w-full pl-12 pr-5 py-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/15 text-on-surface placeholder:text-outline-variant/50 font-body text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
            />
          </div>
        </motion.div>

        <motion.div
          custom={1}
          variants={fieldVariants}
          initial="hidden"
          animate="visible"
        >
          <label className="block mb-2">
            <span className="text-[10px] font-label font-bold tracking-[0.15em] uppercase text-on-surface-variant">
              Teléfono
            </span>
          </label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <Icon name="phone" className="text-primary/60 text-lg" />
            </div>
            <input
              type="tel"
              value={clientInfo.phone}
              onChange={handleChange('phone')}
              placeholder="Ej: 612 345 678"
              autoComplete="tel"
              className="w-full pl-12 pr-5 py-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/15 text-on-surface placeholder:text-outline-variant/50 font-body text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
            />
          </div>
        </motion.div>

        <motion.div
          custom={2}
          variants={fieldVariants}
          initial="hidden"
          animate="visible"
        >
          <label className="block mb-2">
            <span className="text-[10px] font-label font-bold tracking-[0.15em] uppercase text-on-surface-variant">
              Correo electrónico
            </span>
          </label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <Icon name="mail" className="text-primary/60 text-lg" />
            </div>
            <input
              type="email"
              value={clientInfo.email}
              onChange={handleChange('email')}
              placeholder="tu@email.com"
              autoComplete="email"
              className="w-full pl-12 pr-5 py-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/15 text-on-surface placeholder:text-outline-variant/50 font-body text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
            />
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="mt-8 bg-primary/5 rounded-2xl p-5 border border-primary/10"
      >
        <div className="flex items-start gap-3">
          <Icon name="lock" className="text-primary shrink-0 mt-0.5 text-lg" />
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Tus datos solo se usarán para gestionar tu cita. No compartimos tu información con terceros.
          </p>
        </div>
      </motion.div>
    </div>
  )
}
