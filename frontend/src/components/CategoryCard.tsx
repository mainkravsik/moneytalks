import { useRef } from 'react'
import { CategoryBudget } from '../api/budget'

interface Props {
  data: CategoryBudget
  onClick?: () => void
  onLongPress?: () => void
}

export default function CategoryCard({ data, onClick, onLongPress }: Props) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleTouchStart = () => {
    timer.current = setTimeout(() => { onLongPress?.() }, 500)
  }
  const handleTouchEnd = () => {
    if (timer.current) clearTimeout(timer.current)
  }
  const pct = Math.min(data.percent_used, 1)
  const barColor = data.percent_used < 0.7 ? '#4CAF50'
    : data.percent_used < 1 ? '#FF9800'
    : '#F44336'
  const isOver = data.spent > data.limit

  return (
    <div
      onClick={onClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
      style={{
        border: `1px solid ${isOver ? 'rgba(244,67,54,0.4)' : 'rgba(128,128,128,0.2)'}`,
        borderRadius: 10,
        padding: 12,
        background: isOver ? 'rgba(244,67,54,0.05)' : undefined,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 14 }}>{data.category.emoji} {data.category.name}</span>
        <span style={{ fontSize: 12, color: barColor, fontWeight: 'bold' }}>
          ₽{Math.round(data.spent).toLocaleString('ru')} / ₽{Math.round(data.limit).toLocaleString('ru')}
        </span>
      </div>
      <div style={{ background: 'rgba(128,128,128,0.2)', borderRadius: 4, height: 8 }}>
        <div style={{
          background: barColor,
          width: `${Math.min(pct * 100, 100)}%`,
          height: 8,
          borderRadius: 4,
          transition: 'width 0.3s ease',
        }} />
      </div>
      <div style={{ fontSize: 11, opacity: 0.5, marginTop: 4 }}>
        {isOver
          ? `⚠️ Превышено на ₽${Math.round(data.spent - data.limit).toLocaleString('ru')}`
          : `Осталось ₽${Math.round(data.remaining).toLocaleString('ru')}`}
      </div>
    </div>
  )
}
