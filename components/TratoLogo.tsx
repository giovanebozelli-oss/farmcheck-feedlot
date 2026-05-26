import React from 'react';

interface LogoProps {
  /** Largura desejada do logo. Altura é automática (proporção 9:4). */
  width?: number | string;
  className?: string;
  /** Se true, exibe o subtítulo "Gestão de Confinamento". Default: true */
  showTagline?: boolean;
}

/**
 * Logotipo Trato — versão SVG inline (escalável, sem dependência de imagem).
 * Identidade: badge azul-marinho com borda arredondada esmeralda, palavra
 * "Trato" com "Tra" branco + "to" esmeralda, subtítulo "Gestão de Confinamento".
 */
const TratoLogo: React.FC<LogoProps> = ({ width = 420, className = '', showTagline = true }) => {
  // viewBox proporcional. Altura ajusta conforme tem ou não tagline.
  const vbWidth = 500;
  const vbHeight = showTagline ? 220 : 180;

  return (
    <div className={`select-none ${className}`} style={{ width }}>
      <svg
        viewBox={`0 0 ${vbWidth} ${vbHeight}`}
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto drop-shadow-2xl"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Badge fundo */}
        <path
          d={`M40 10H460C475 10 490 25 490 40V${showTagline ? 160 : 140}C490 ${showTagline ? 175 : 155} 475 ${showTagline ? 190 : 170} 460 ${showTagline ? 190 : 170}L250 ${vbHeight - 10}L40 ${showTagline ? 190 : 170}C25 ${showTagline ? 190 : 170} 10 ${showTagline ? 175 : 155} 10 ${showTagline ? 160 : 140}V40C10 25 25 10 40 10Z`}
          fill="#001F3F"
          stroke="#001F3F"
          strokeWidth="2"
        />
        {/* Borda interna esmeralda */}
        <path
          d={`M43 13H457C470 13 487 30 487 43V${showTagline ? 157 : 137}C487 ${showTagline ? 170 : 150} 470 ${showTagline ? 187 : 167} 457 ${showTagline ? 187 : 167}L250 ${vbHeight - 13}L43 ${showTagline ? 187 : 167}C30 ${showTagline ? 187 : 167} 13 ${showTagline ? 170 : 150} 13 ${showTagline ? 157 : 137}V43C13 30 30 13 43 13Z`}
          stroke="#10b981"
          strokeWidth="2"
          fill="none"
        />
        {/* Palavra "Trato" — "Tra" branco, "to" esmeralda */}
        <text
          x="180"
          y="115"
          fill="white"
          style={{ font: 'bold 88px "Georgia", "Times New Roman", serif' }}
          textAnchor="middle"
        >
          Tra
        </text>
        <text
          x="320"
          y="115"
          fill="#10b981"
          style={{ font: 'bold 88px "Georgia", "Times New Roman", serif' }}
          textAnchor="middle"
        >
          to
        </text>
        {showTagline && (
          <>
            <line x1="70" y1="152" x2="135" y2="152" stroke="#10b981" strokeWidth="3" />
            <text
              x="250"
              y="160"
              fill="#10b981"
              style={{ font: 'bold 20px ui-sans-serif, system-ui', letterSpacing: '4px' }}
              textAnchor="middle"
            >
              GESTÃO DE CONFINAMENTO
            </text>
            <line x1="365" y1="152" x2="430" y2="152" stroke="#10b981" strokeWidth="3" />
          </>
        )}
      </svg>
    </div>
  );
};

export default TratoLogo;
