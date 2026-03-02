import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { toWallet } from '@/lib/link'
import { formatPubkey, generateImageByPubkey } from '@/lib/pubkey'
import { usePrimaryPage, useSecondaryPage } from '@/PageManager'
import { useCompactSidebar } from '@/providers/CompactSidebarProvider'
import { useNostr } from '@/providers/NostrProvider'
import { ArrowDownUp, LogIn, LogOut, Settings, UserRound, Wallet } from 'lucide-react'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import LoginDialog from '../LoginDialog'
import LogoutDialog from '../LogoutDialog'
import SidebarItem from './SidebarItem'

export default function AccountButton() {
  const { pubkey } = useNostr()

  if (pubkey) {
    return <ProfileButton />
  } else {
    return <LoginButton />
  }
}

const ProfileButtonContent = React.forwardRef<HTMLButtonElement, { username: string, avatar: string, defaultAvatar: string }>(
  ({ username, avatar, defaultAvatar, ...props }, ref) => {
    const { compactSidebar } = useCompactSidebar()

    return (
      <Button
        ref={ref}
        variant="ghost"
        className={cn(
          "clickable shadow-none p-2 w-12 h-12 flex items-center bg-transparent text-foreground hover:text-accent-foreground rounded-lg justify-start gap-4 font-medium transition-all duration-300",
          compactSidebar ? "" : "xl:px-2 xl:py-2 xl:w-full xl:h-auto"
        )}
        style={{ fontSize: 'var(--font-size, 14px)' }}
        {...props}
      >
        <div className="flex gap-2 items-center flex-1 w-0">
          <Avatar className="w-8 h-8 opacity-100">
            <AvatarImage src={avatar} />
            <AvatarFallback>
              <img src={defaultAvatar} />
            </AvatarFallback>
          </Avatar>
          <div className={cn("truncate font-medium", compactSidebar ? "hidden" : "max-xl:hidden")}>{username}</div>
        </div>
      </Button>
    )
  }
)

function ProfileButton() {
  const { t } = useTranslation()
  const { account, profile } = useNostr()
  const { compactSidebar } = useCompactSidebar()
  const pubkey = account?.pubkey
  const { navigate } = usePrimaryPage()
  const { push } = useSecondaryPage()
  const [loginDialogOpen, setLoginDialogOpen] = useState(false)
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)
  if (!pubkey) return null

  const defaultAvatar = generateImageByPubkey(pubkey)
  const { username, avatar } = profile || { username: formatPubkey(pubkey), avatar: defaultAvatar }

  const dropdownMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ProfileButtonContent username={username} avatar={avatar} defaultAvatar={defaultAvatar} />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top">
        <DropdownMenuItem onClick={() => navigate('profile')}>
          <UserRound />
          {t('Profile')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => push('/settings')}>
          <Settings />
          {t('Settings')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => push(toWallet())}>
          <Wallet />
          {t('Wallet')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setLoginDialogOpen(true)}>
          <ArrowDownUp />
          {t('Switch account')}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => setLogoutDialogOpen(true)}
        >
          <LogOut />
          {t('Logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
      <LoginDialog open={loginDialogOpen} setOpen={setLoginDialogOpen} />
      <LogoutDialog open={logoutDialogOpen} setOpen={setLogoutDialogOpen} />
    </DropdownMenu>
  )

  // Show tooltip in compact mode or on screens where username is hidden
  if (compactSidebar) {
    return (
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <div>
            {dropdownMenu}
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          sideOffset={8}
          className="font-medium text-sm px-3 py-2 bg-card border-border shadow-lg"
        >
          {username}
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <>
      {/* Tooltip for smaller screens where username is hidden */}
      <span className="xl:hidden">
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <div>
              {dropdownMenu}
            </div>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            sideOffset={8}
            className="font-medium text-sm px-3 py-2 bg-card border-border shadow-lg"
          >
            {username}
          </TooltipContent>
        </Tooltip>
      </span>
      {/* No tooltip when username is visible */}
      <span className="max-xl:hidden">
        {dropdownMenu}
      </span>
    </>
  )
}

function LoginButton() {
  const { t } = useTranslation()
  const { checkLogin } = useNostr()

  return (
    <SidebarItem onClick={() => checkLogin()} title={t('Login')}>
      <LogIn strokeWidth={1.3} />
    </SidebarItem>
  )
}
