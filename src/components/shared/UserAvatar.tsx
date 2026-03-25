import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface Props {
  name: string
  avatarUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
}

const sizeMap = { sm: 'size-6', md: 'size-8', lg: 'size-10' }

export default function UserAvatar({ name, avatarUrl, size = 'md' }: Props) {
  return (
    <Avatar className={sizeMap[size]}>
      <AvatarImage src={avatarUrl ?? undefined} alt={name} />
      <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
  )
}
