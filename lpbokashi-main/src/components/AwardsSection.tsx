import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Plate {
  id: number;
  value: string;
  label: string;
  title: string;
  desc: string;
  color: string;
  gradient: string;
  image?: string;
}

const platesData: Plate[] = [
  {
    id: 0,
    value: '10K',
    label: 'em vendas',
    title: '10 MIL',
    desc: 'Sua primeira grande conquista. O começo de uma jornada incrível.',
    color: '#9ca3af',
    gradient: 'radial-gradient(circle at 50% 30%, #1f2937 0%, #000000 100%)',
    image: '/placa-10k.jpg',
  },
  {
    id: 1,
    value: '100K',
    label: 'em vendas',
    title: '100 MIL',
    desc: 'Consistência e escala. Você está no caminho dos gigantes.',
    color: '#22c55e',
    gradient: 'radial-gradient(circle at 50% 30%, #15803d 0%, #064e3b 100%)',
    image: '/placa-100k.jpg',
  },
  {
    id: 2,
    value: '500K',
    label: 'em vendas',
    title: '500 MIL',
    desc: 'Meio milhão. Um marco de autoridade e domínio de mercado.',
    color: '#ef4444',
    gradient: 'radial-gradient(circle at 50% 30%, #7f1d1d 0%, #1a0202 100%)',
    image: '/placa-500k.jpg',
  },
  {
    id: 3,
    value: '1M',
    label: 'em vendas',
    title: '1 MILHÃO',
    desc: 'O cobiçado clube dos milionários. Sua vida mudou.',
    color: '#3b82f6',
    gradient: 'radial-gradient(circle at 50% 30%, #1e3a8a 0%, #020617 100%)',
    image: '/placa-1m.jpg',
  },
  {
    id: 4,
    value: '5M',
    label: 'em vendas',
    title: '5 MILHÕES',
    desc: 'Lenda do mercado. Um legado construído com maestria.',
    color: '#a855f7',
    gradient: 'radial-gradient(circle at 50% 30%, #581c87 0%, #1a0a2e 100%)',
    image: '/placa-5m.jpg',
  },
];

export default function AwardsSection() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const totalItems = platesData.length;

  const moveCarousel = (direction: number) => {
    setCurrentIndex((prev) => (prev + direction + totalItems) % totalItems);
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  const getItemClass = (idx: number): string => {
    const diff = ((idx - currentIndex) % totalItems + totalItems) % totalItems;
    if (diff === 0) return 'active';
    if (diff === 1) return 'next';
    if (diff === 2) return 'next-2';
    if (diff === totalItems - 1) return 'prev';
    if (diff === totalItems - 2) return 'prev-2';
    return 'hidden-item';
  };

  // Auto-play: avança sozinho a cada 4s, pausa quando o usuário interage
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % totalItems);
    }, 4000);
    return () => clearInterval(interval);
  }, [isPaused, totalItems]);

  // Pausa ao interagir, retoma após 6s
  useEffect(() => {
    if (!isPaused) return;
    const resumeTimeout = setTimeout(() => setIsPaused(false), 6000);
    return () => clearTimeout(resumeTimeout);
  }, [isPaused, currentIndex]);

  const handleUserInteraction = (action: () => void) => {
    setIsPaused(true);
    action();
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handleUserInteraction(() => moveCarousel(-1));
      }
      if (e.key === 'ArrowRight') {
        handleUserInteraction(() => moveCarousel(1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const activePlate = platesData[currentIndex];

  return (
    <section
      id="premiacoes"
      className="relative w-full overflow-hidden bg-[#050f08] py-16 md:py-24"
    >
      {/* Dynamic background glow */}
      <div
        aria-hidden
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vh] rounded-full pointer-events-none z-0"
        style={{
          background: activePlate.color,
          filter: 'blur(150px)',
          opacity: 0.2,
          transition: 'background 0.8s ease',
        }}
      />

      {/* Header */}
      <header className="relative z-10 w-full max-w-5xl mx-auto pt-4 md:pt-8 px-4 text-center">
        <div className="inline-block border border-gray-800 rounded-full px-4 py-1 text-xs text-gray-400 mb-6 tracking-widest uppercase">
          Programa de Premiação
        </div>

        <h1 className="text-4xl md:text-6xl font-bold mb-4 text-white">
          Placas de{' '}
          <span
            className="px-2 py-1 rounded transition-colors duration-300"
            style={{
              backgroundColor: activePlate.color,
              color: activePlate.color === '#ffffff' ? '#000000' : '#000000',
            }}
          >
            Premiação
          </span>
        </h1>

        <p className="text-gray-400 text-sm md:text-base max-w-2xl mx-auto mb-10">
          A cada meta atingida, você recebe uma placa exclusiva na sua casa. Um troféu físico que marca a sua trajetória de sucesso.
        </p>
      </header>

      {/* Carousel */}
      <main className="relative z-10 w-full max-w-6xl mx-auto px-4">
        <div
          className="relative w-full"
          style={{
            height: '400px',
            perspective: '1000px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {/* Navigation buttons */}
          <button
            onClick={() => handleUserInteraction(() => moveCarousel(-1))}
            className="absolute top-1/2 -translate-y-1/2 w-10 h-10 md:left-[10%] left-2 rounded-full bg-white/10 border border-white/20 text-white flex items-center justify-center z-10 transition-all hover:bg-primary hover:border-primary"
            aria-label="Anterior"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => handleUserInteraction(() => moveCarousel(1))}
            className="absolute top-1/2 -translate-y-1/2 w-10 h-10 md:right-[10%] right-2 rounded-full bg-white/10 border border-white/20 text-white flex items-center justify-center z-10 transition-all hover:bg-primary hover:border-primary"
            aria-label="Próximo"
          >
            <ChevronRight size={20} />
          </button>

          {/* Carousel items */}
          {platesData.map((plate, index) => {
            const positionClass = getItemClass(index);
            return (
              <div
                key={plate.id}
                onClick={() => goToSlide(index)}
                className={`
                  carousel-item ${positionClass}
                  absolute w-[200px] md:w-[260px] h-[300px] md:h-[360px]
                  rounded-xl overflow-hidden cursor-pointer
                  flex flex-col justify-center items-center
                  transition-all duration-500 ease-in-out
                `}
                style={{
                  background: 'linear-gradient(145deg, #111 0%, #000 100%)',
                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.8)',
                  border: positionClass === 'active' ? `2px solid ${plate.color}` : '2px solid transparent',
                }}
              >
                {plate.image ? (
                  <img
                    src={plate.image}
                    alt={`Placa ${plate.value}`}
                    className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
                    style={{
                      opacity: positionClass === 'active' ? 1 : 0.85,
                    }}
                  />
                ) : (
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-opacity duration-300"
                    style={{
                      background: plate.gradient,
                      opacity: positionClass === 'active' ? 1 : 0.8,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Active plate info */}
        <div className="text-center mt-8 mb-4 min-h-24 px-4">
          <div className="text-xs tracking-widest text-gray-500 mb-2 uppercase">
            Placa Atual
          </div>
          <h2 className="text-2xl md:text-3xl font-light italic mb-2 text-white">
            {activePlate.title}{' '}
            <span className="text-gray-400 text-base md:text-lg">{activePlate.label}</span>
          </h2>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            {activePlate.desc}
          </p>
        </div>

        {/* Thumbnails */}
        <div className="flex gap-3 md:gap-4 mt-6 justify-center flex-wrap px-4">
          {platesData.map((plate, index) => {
            const isActive = index === currentIndex;
            return (
              <div
                key={plate.id}
                onClick={() => handleUserInteraction(() => goToSlide(index))}
                className={`
                  relative w-[60px] h-[80px] md:w-[70px] md:h-[90px] rounded-md cursor-pointer
                  transition-all duration-300 overflow-hidden
                  ${isActive
                    ? 'opacity-100 scale-110'
                    : 'opacity-50 hover:opacity-90'
                  }
                `}
                style={{
                  background: plate.image
                    ? '#000'
                    : plate.gradient,
                  backgroundImage: plate.image
                    ? `url(${plate.image})`
                    : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  border: isActive ? `2px solid ${plate.color}` : '2px solid transparent',
                  boxShadow: isActive ? `0 0 15px ${plate.color}99` : 'none',
                }}
              />
            );
          })}
        </div>
      </main>

      {/* Internal styles for 3D carousel positioning */}
      <style>{`
        .carousel-item.active {
          transform: translateX(0) scale(1) translateZ(0);
          z-index: 3;
        }
        .carousel-item.prev {
          transform: translateX(-45%) scale(0.85) translateZ(-100px) rotateY(15deg);
          z-index: 2;
          filter: brightness(0.5);
        }
        .carousel-item.next {
          transform: translateX(45%) scale(0.85) translateZ(-100px) rotateY(-15deg);
          z-index: 2;
          filter: brightness(0.5);
        }
        .carousel-item.prev-2 {
          transform: translateX(-75%) scale(0.7) translateZ(-250px) rotateY(25deg);
          z-index: 1;
          filter: brightness(0.3);
          opacity: 0.8;
        }
        .carousel-item.next-2 {
          transform: translateX(75%) scale(0.7) translateZ(-250px) rotateY(-25deg);
          z-index: 1;
          filter: brightness(0.3);
          opacity: 0.8;
        }
        .carousel-item.hidden-item {
          transform: scale(0.5) translateZ(-400px);
          z-index: 0;
          opacity: 0;
          pointer-events: none;
        }

        @media (max-width: 768px) {
          .carousel-item.prev {
            transform: translateX(-60%) scale(0.85) translateZ(-100px) rotateY(15deg);
          }
          .carousel-item.next {
            transform: translateX(60%) scale(0.85) translateZ(-100px) rotateY(-15deg);
          }
          .carousel-item.prev-2 {
            transform: translateX(-90%) scale(0.7) translateZ(-250px) rotateY(25deg);
          }
          .carousel-item.next-2 {
            transform: translateX(90%) scale(0.7) translateZ(-250px) rotateY(-25deg);
          }
        }
      `}</style>
    </section>
  );
}
