import pygame
import pygame.locals
import sys
import json
import random


pygame.init()

# ---------------- SETUP ---------------- #
clock = pygame.time.Clock()
fps = 60

screen_width = 1000
screen_height = 1000

screen = pygame.display.set_mode((screen_width, screen_height))
pygame.display.set_caption('Platformer')

# ---------------- GAME VARIABLES ---------------- #
tile_size = 50
game_over = False
score = 0
total_score = 0  # Track total score across all levels

# load images
bg_img = pygame.image.load('bilder/8bit-pixel-graphic-blue-sky-background-with-clouds-vector.jpg')
Menu_img = pygame.image.load('bilder/8bit-pixel-graphic-blue-sky-background-with-clouds-vector.jpg')

# ---------------- SPRITE CLASSES ---------------- #
# Sprites (spillere og fiender)
# - Player: håndterer bevegelse, hopp, tyngdekraft og kollisjoner
# - Enemy / FastEnemy / YellowEnemy: enkle fiender med forskjellig hastighet
# - KingEnemy: boss med mønster, dash og hopp
class Player(pygame.sprite.Sprite):
    def __init__(self, x, y):
        super().__init__()

        img = pygame.image.load('bilder/Goldie.png')
        self.image = pygame.transform.scale(img, (35, 45))
        self.rect = self.image.get_rect(topleft=(x, y))

        self.width = self.image.get_width()
        self.height = self.image.get_height()

        self.vel_y = 0
        self.jumped = False
        self.in_air = True


    def update(self):
        dx = 0
        dy = 0

        key = pygame.key.get_pressed()
        if key[pygame.K_SPACE] and not self.jumped and not self.in_air:
            self.vel_y = -15
            self.jumped = True
        if not key[pygame.K_SPACE]:
            self.jumped = False
        if key[pygame.K_LEFT]:
            dx -= 4
        if key[pygame.K_RIGHT]:
            dx += 4

        # gravity
        self.vel_y += 1
        if self.vel_y > 10:
            self.vel_y = 10
        dy += self.vel_y

        # collision
        self.in_air = True
        for tile in world.tile_list:
            if tile[1].colliderect(self.rect.x + dx, self.rect.y, self.width, self.height):
                dx = 0
            if tile[1].colliderect(self.rect.x, self.rect.y + dy, self.width, self.height):
                if self.vel_y < 0:
                    dy = tile[1].bottom - self.rect.top
                    self.vel_y = 0
                elif self.vel_y >= 0:
                    dy = tile[1].top - self.rect.bottom
                    self.vel_y = 0
                    self.in_air = False

        # collision with FinalTile
        for tile in final_tile_group:
            if tile.is_collidable():
                if tile.rect.colliderect(self.rect.x + dx, self.rect.y, self.width, self.height):
                    dx = 0
                if tile.rect.colliderect(self.rect.x, self.rect.y + dy, self.width, self.height):
                    if self.vel_y < 0:
                        dy = tile.rect.bottom - self.rect.top
                        self.vel_y = 0
                    elif self.vel_y >= 0:
                        dy = tile.rect.top - self.rect.bottom
                        self.vel_y = 0
                        self.in_air = False

        self.rect.x += dx
        self.rect.y += dy
        return self.rect


# Enkle fiender som går fram og tilbake
class Enemy(pygame.sprite.Sprite):
    def __init__(self, x, y):
        super().__init__()
        self.image = pygame.image.load('bilder/Superfast.png')
        self.image = pygame.transform.scale(self.image, (40, 50))
        self.rect = self.image.get_rect(topleft=(x, y))
        self.move_direction = 1
        self.move_counter = 0

    def update(self):
        self.rect.x += self.move_direction
        self.move_counter += 1
        if abs(self.move_counter) > 50:
            self.move_direction *= -1
            self.move_counter *= -1


# Raskere fiendevariant
class FastEnemy(pygame.sprite.Sprite):
    def __init__(self, x, y):
        super().__init__()
        self.image = pygame.image.load('bilder/Fastslime.png')
        self.image = pygame.transform.scale(self.image, (50, 50))
        self.rect = self.image.get_rect(topleft=(x, y))
        self.move_direction = 6
        self.move_counter = 0

    def update(self):
        self.rect.x += self.move_direction
        self.move_counter += 3
        if abs(self.move_counter) > 50:
            self.move_direction *= -1
            self.move_counter *= -1


# Gul/annet fiende-design 
class YellowEnemy(pygame.sprite.Sprite):
    def __init__(self, x, y):
        super().__init__()
        self.image = pygame.image.load('bilder/Slime.png')
        self.image = pygame.transform.scale(self.image, (40, 50))
        self.rect = self.image.get_rect(topleft=(x, y))
        self.move_direction = 6
        self.move_counter = 0

    def update(self):
        self.rect.x += self.move_direction
        self.move_counter += 4
        if abs(self.move_counter) > 50:
            self.move_direction *= -1
            self.move_counter *= -1

# KingEnemy: Bossfiende med avansert adferd (dash, jump, enraged)
class KingEnemy(pygame.sprite.Sprite):
    def __init__(self, x, y, all_sprites_group, enemy_group, world):
        super().__init__()
        self.original_image = pygame.transform.scale(
            pygame.image.load("bilder/Kingslime.png").convert_alpha(), (85, 85)
        )
        self.image = self.original_image.copy()
        self.rect = self.image.get_rect(topleft=(x, y))

        # Movement & world
        self.world = world
        self.move_direction = 1
        self.speed = 3
        self.gravity = 2.5
        self.vertical_velocity = 0
        self.move_counter = 0
        self.max_move_counter = random.randint(150, 250)

        # Pattern system
        self.pattern = ["dash", "dash", "jump"]
        self.pattern_index = 0
        self.jump_timer = 0
        self.jump_interval = random.randint(50, 100)
        self.last_jump_time = 0
        self.jump_cooldown = 100

        # Dash
        self.is_dashing = False
        self.dash_speed = 14
        self.dash_duration = 18
        self.dash_timer = 0
        self.dash_cooldown_timer = 0

        # Health
        self.health = 4
        self.max_health = 4
        self.alive = True
        self.flash_timer = 0

        # Enraged
        self.enraged = False

    # ----------------------------------------------------------------

    def update(self):
        if not self.alive:
            return

        self.dash_cooldown_timer = max(0, self.dash_cooldown_timer - 1)

        if not self.enraged and self.health <= 2:
            self.enter_enraged_mode()

        self.horizontal_movement()
        self.process_action_pattern()
        self.apply_gravity()
        self.update_flash()

    # ----------------------------------------------------------------

    def horizontal_movement(self):
        speed = self.dash_speed if self.is_dashing else self.speed
        self.rect.x += self.move_direction * speed

        self.horizontal_collision()

        if self.is_dashing:
            self.dash_timer -= 1
            if self.dash_timer <= 0:
                self.is_dashing = False
        else:
            self.move_counter += 1
            if self.move_counter >= self.max_move_counter:
                self.move_direction *= -1
                self.move_counter = 0
                self.max_move_counter = random.randint(150, 250)

    # ----------------------------------------------------------------

    def process_action_pattern(self):
        self.jump_timer += 1

        if (
            self.jump_timer < self.jump_interval
            or self.vertical_velocity != 0
        ):
            return

        # Time to act
        action = self.pattern[self.pattern_index]
        self.pattern_index = (self.pattern_index + 1) % len(self.pattern)
        self.jump_timer = 0
        self.jump_interval = random.randint(20 if self.enraged else 50,
                                            50 if self.enraged else 100)

        # Jump
        if action == "jump":
            if pygame.time.get_ticks() - self.last_jump_time >= (self.jump_cooldown * 100 / 60):
                self.vertical_velocity = random.randint(-40, -30)
                self.last_jump_time = pygame.time.get_ticks()

        # Dash
        elif action == "dash" and self.dash_cooldown_timer == 0 and self.can_dash():
            self.start_dash()
            self.dash_cooldown_timer = 30 if self.enraged else 60

    # ----------------------------------------------------------------

    def apply_gravity(self):
        self.vertical_velocity = min(self.vertical_velocity + self.gravity, 8)
        self.rect.y += self.vertical_velocity

        for _, tile in self.world.tile_list:
            if tile.colliderect(self.rect.x, self.rect.y, self.rect.width, self.rect.height):
                if self.vertical_velocity > 0:
                    self.rect.bottom = tile.top
                    self.vertical_velocity = 0
                return

        # Fall limit
        if self.rect.bottom > 1000:
            self.rect.bottom = 1000
            self.vertical_velocity = 0

    # ----------------------------------------------------------------

    def horizontal_collision(self):
        for _, tile in self.world.tile_list:
            if tile.colliderect(self.rect):
                if self.move_direction > 0:
                    self.rect.right = tile.left
                else:
                    self.rect.left = tile.right
                self.is_dashing = False
                self.move_direction *= -1
                self.move_counter = 0
                return

    # ----------------------------------------------------------------

    def can_dash(self):
        future = self.rect.copy()
        future.x += self.move_direction * (self.dash_speed * self.dash_duration // 2)
        return not any(tile.colliderect(future) for _, tile in self.world.tile_list)

    def start_dash(self):
        self.is_dashing = True
        self.dash_speed = random.randint(12, 18)
        self.dash_duration = random.randint(10, 20)
        self.dash_timer = self.dash_duration

    # ----------------------------------------------------------------

    def take_damage(self):
        self.health -= 1
        self.flash_timer = 20
        if self.health <= 0:
            self.alive = False
            self.kill()

    def update_flash(self):
        if self.flash_timer > 0:
            self.flash_timer -= 1
            self.image = self.tint((255, 0, 0))
        else:
            self.image = self.original_image.copy()

        if self.enraged and self.flash_timer == 0:
            if pygame.time.get_ticks() % 400 < 200:
                self.image = self.tint((150, 30, 30))

    def tint(self, color):
        img = self.original_image.copy()
        img.fill(color + (0,), None, pygame.BLEND_RGBA_ADD)
        return img

    # ----------------------------------------------------------------

    def enter_enraged_mode(self):
        self.enraged = True
        self.speed = 3
        self.dash_speed = 16
        self.dash_duration = 15
        self.max_move_counter = random.randint(60, 120)

    # ----------------------------------------------------------------

    def draw_health_bar(self, surface):
        if not self.alive:
            return
        bar_width = 100
        bar_height = 10
        fill = int((self.health / self.max_health) * bar_width)
        outline_rect = pygame.Rect(self.rect.x, self.rect.y - 20, bar_width, bar_height)
        fill_rect = pygame.Rect(self.rect.x, self.rect.y - 20, fill, bar_height)
        pygame.draw.rect(surface, (255, 0, 0), outline_rect)
        pygame.draw.rect(surface, (0, 255, 0), fill_rect)


# Lava: dødelig overflate, ikke kolliderbar som vanlig flis
class Lava(pygame.sprite.Sprite):
    def __init__(self, x, y):
        super().__init__()
        img = pygame.image.load('bilder/lava.png')
        self.image = pygame.transform.scale(img, (tile_size, tile_size // 2))
        self.rect = self.image.get_rect(topleft=(x, y))


# ---------- UPDATED FINAL TILE CLASS ---------- #
# FinalTile: en spesiell flis som fader inn når bossen er beseiret
class FinalTile(pygame.sprite.Sprite):
    def __init__(self, x, y):
        super().__init__()
        img = pygame.image.load('bilder/Goldblock.png').convert_alpha()
        self.visible_image = pygame.transform.scale(img, (tile_size, tile_size // 2))
        self.hidden_image = pygame.Surface((tile_size, tile_size // 2), pygame.SRCALPHA)
        self.image = self.hidden_image
        self.rect = self.image.get_rect(topleft=(x, y))
        self.visible = False
        self.alpha = 0
        self.fade_duration = 2000
        self.fade_start_time = None
        self.should_appear = False

    def trigger_appearance(self):
        if not self.should_appear:
            self.should_appear = True
            self.fade_start_time = pygame.time.get_ticks()

    def update(self):
        if self.should_appear and not self.visible:
            elapsed = pygame.time.get_ticks() - self.fade_start_time
            fade_progress = min(elapsed / self.fade_duration, 1.0)
            self.alpha = int(fade_progress * 255)
            temp_image = self.visible_image.copy()
            temp_image.set_alpha(self.alpha)
            self.image = temp_image
            if self.alpha >= 255:
                self.visible = True
                self.image = self.visible_image

    def is_collidable(self):
        return self.visible
# ------------------------------------------------- #


# Coin: samleobjekt som øker spillerens score
class Coin(pygame.sprite.Sprite):
    def __init__(self, x, y):
        super().__init__()
        img = pygame.image.load('bilder/Coin.png')
        self.image = pygame.transform.scale(img, (tile_size - 5, tile_size - 5))
        self.rect = self.image.get_rect(center=(x, y))


# Exit: vanlig utgang til neste nivå
class Exit(pygame.sprite.Sprite):
    def __init__(self, x, y):
        super().__init__()
        img = pygame.image.load('bilder/Portal.png')
        self.image = pygame.transform.scale(img, (tile_size + 5, int(tile_size * 2)))
        self.rect = self.image.get_rect(topleft=(x, y))


# FinalExit: endelig utgang / kiste (kan bruke placeholder-bilde)
class FinalExit(pygame.sprite.Sprite):
    def __init__(self, x, y):
        super().__init__()
        img = pygame.image.load('bilder/chest.png')
        self.image = pygame.transform.scale(img, (tile_size + 5, int(tile_size * 2)))
        self.rect = self.image.get_rect(topleft=(x, y))



# ---------------- WORLD CLASS ---------------- #
class World:
    def __init__(self, data):
        self.tile_list = []
        dirt_img = pygame.image.load('bilder/DirtBlock2D.png')
        grass_img = pygame.image.load('bilder/GrassBlock2D.png')
        stone_img = pygame.image.load('bilder/Sigmastone.png')

        row_count = 0
        for row in data:
            col_count = 0
            for tile in row:
                if tile == 1:
                    img = pygame.transform.scale(dirt_img, (tile_size, tile_size))
                    img_rect = img.get_rect(topleft=(col_count * tile_size, row_count * tile_size))
                    self.tile_list.append((img, img_rect))
                if tile == 2:
                    img = pygame.transform.scale(grass_img, (tile_size, tile_size))
                    img_rect = img.get_rect(topleft=(col_count * tile_size, row_count * tile_size))
                    self.tile_list.append((img, img_rect))
                if tile == 8:
                    img = pygame.transform.scale(stone_img, (tile_size, tile_size))
                    img_rect = img.get_rect(topleft=(col_count * tile_size, row_count * tile_size))
                    self.tile_list.append((img, img_rect))
                if tile == 3:
                    blob_group.add(Enemy(col_count * tile_size, row_count * tile_size))
                if tile == 4:
                    lava_group.add(Lava(col_count * tile_size, row_count * tile_size + tile_size // 2))
                if tile == 5:
                    coin_group.add(Coin(col_count * tile_size, row_count * tile_size + tile_size // 2))
                if tile == 6:
                    blob_group.add(FastEnemy(col_count * tile_size, row_count * tile_size))
                if tile == 7:
                    boss = KingEnemy(col_count * tile_size, row_count * tile_size, blob_group, blob_group, self)
                    blob_group.add(boss)
                if tile == 9:
                    exit_group.add(Exit(col_count * tile_size, row_count * tile_size))
                if tile == 10:
                    exit_group.add(FinalExit(col_count * tile_size, row_count * tile_size))
                if tile == 11:
                    blob_group.add(YellowEnemy(col_count * tile_size, row_count * tile_size))
                if tile == 12:
                    final_tile = FinalTile(col_count * tile_size, row_count * tile_size)
                    final_tile_group.add(final_tile)

                col_count += 1
            row_count += 1

    def draw(self):
        for tile in self.tile_list:
            screen.blit(tile[0], tile[1])


# ---------------- LOAD LEVELS FROM JSON ---------------- #
with open('levels.json', 'r') as f:
    level_data = json.load(f)

levels = level_data["levels"]
current_level = 0

# ---------------- CREATE GROUPS ---------------- #
blob_group = pygame.sprite.Group()
lava_group = pygame.sprite.Group()
coin_group = pygame.sprite.Group()
exit_group = pygame.sprite.Group()
final_tile_group = pygame.sprite.Group()

world = World(levels[current_level])
player = Player(50, screen_height - 300)


# ---------------- HELPER FUNCTIONS ---------------- #
def reset_level(level_index):
    global score
    blob_group.empty()
    lava_group.empty()
    coin_group.empty()
    exit_group.empty()
    final_tile_group.empty()
    world = World(levels[level_index])
    player = Player(50, screen_height - 300)
    score = 0
    return world, player


def fade_out_to_menu():
    overlay = pygame.Surface((screen_width, screen_height))
    overlay.fill((0, 0, 0))
    for alpha in range(0, 256, 10):
        overlay.set_alpha(alpha)
        screen.blit(overlay, (0, 0))
        pygame.display.update()
        pygame.time.delay(30)


def main_menu():
    menu = True
    title_font = pygame.font.SysFont('Bauhaus 93', 100)
    button_font = pygame.font.SysFont('Press Start 2P', 50)

    while menu:
        screen.blit(Menu_img, (-125, -45))
        title_text = title_font.render('GOLDIES ADVENTURE', True, (255, 255, 0))
        title_rect = title_text.get_rect(center=(screen_width // 2, screen_height // 2 - 200))
        screen.blit(title_text, title_rect)

        start_rect = pygame.Rect(screen_width // 2 - 250, screen_height // 2 - 40, 500, 80)
        quit_rect = pygame.Rect(screen_width // 2 - 250, screen_height // 2 + 60, 500, 80)
        mouse_pos = pygame.mouse.get_pos()

        start_color = (0, 255, 0) if not start_rect.collidepoint(mouse_pos) else (50, 255, 50)
        quit_color = (255, 0, 0) if not quit_rect.collidepoint(mouse_pos) else (255, 50, 50)

        pygame.draw.rect(screen, start_color, start_rect, border_radius=50)
        pygame.draw.rect(screen, quit_color, quit_rect, border_radius=50)

        start_text = button_font.render('START GAME', True, (0, 0, 0))
        quit_text = button_font.render('QUIT', True, (0, 0, 0))
        screen.blit(start_text, start_text.get_rect(center=start_rect.center))
        screen.blit(quit_text, quit_text.get_rect(center=quit_rect.center))

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                sys.exit()
            if event.type == pygame.MOUSEBUTTONDOWN:
                if start_rect.collidepoint(event.pos):
                    menu = False
                if quit_rect.collidepoint(event.pos):
                    pygame.quit()
                    sys.exit()

        pygame.display.update()
        clock.tick(fps)


def show_loading_screen(level_num):
    font = pygame.font.SysFont('Bauhaus 93', 80)
    text = font.render(f'Loading Level {level_num + 1}...', True, (255, 255, 255))
    text_rect = text.get_rect(center=(screen_width // 2, screen_height // 2))
    overlay = pygame.Surface((screen_width, screen_height))
    overlay.fill((0, 0, 0))

    for alpha in range(0, 256, 10):
        overlay.set_alpha(alpha)
        screen.blit(overlay, (0, 0))
        screen.blit(text, text_rect)
        pygame.display.update()
        pygame.time.delay(30)

    pygame.time.delay(1000)
    for alpha in range(255, -1, -10):
        overlay.set_alpha(alpha)
        screen.blit(overlay, (0, 0))
        screen.blit(text, text_rect)
        pygame.display.update()
        pygame.time.delay(30)


def show_win_screen(total_score):
    font = pygame.font.SysFont('Bauhaus 93', 100)
    score_font = pygame.font.SysFont('Press Start 2P', 40)
    button_font = pygame.font.SysFont('Press Start 2P', 40)

    win_text = font.render('YOU WIN!', True, (255, 255, 0))
    score_text = score_font.render(f'Total Score: {total_score}/40  ', True, (255, 255, 255))
    win_rect = win_text.get_rect(center=(screen_width // 2, screen_height // 2 - 100))
    score_rect = score_text.get_rect(center=(screen_width // 2, screen_height // 2 + 10))
    overlay = pygame.Surface((screen_width, screen_height))
    overlay.fill((0, 0, 0))

    for alpha in range(0, 256, 10):
        overlay.set_alpha(alpha)
        screen.blit(overlay, (0, 0))
        screen.blit(win_text, win_rect)
        screen.blit(score_text, score_rect)
        pygame.display.update()
        pygame.time.delay(50)

    pygame.time.delay(1500)
    menu_rect = pygame.Rect(screen_width // 2 - 250, screen_height // 2 + 100, 500, 80)
    running = True
    while running:
        screen.fill((0, 0, 0))
        screen.blit(win_text, win_rect)
        screen.blit(score_text, score_rect)

        mouse_pos = pygame.mouse.get_pos()
        menu_color = (0, 255, 0) if menu_rect.collidepoint(mouse_pos) else (0, 200, 0)
        pygame.draw.rect(screen, menu_color, menu_rect, border_radius=50)
        menu_text = button_font.render('MAIN MENU', True, (0, 0, 0))
        screen.blit(menu_text, menu_text.get_rect(center=menu_rect.center))

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                sys.exit()
            elif event.type == pygame.MOUSEBUTTONDOWN:
                if menu_rect.collidepoint(event.pos):
                    fade_out_to_menu()
                    running = False
                    main_menu()
                    return

        pygame.display.update()
        clock.tick(fps)


# ---------------- RUN MENU ---------------- #
main_menu()
show_loading_screen(current_level)

# ---------------- MAIN GAME LOOP ---------------- #
run = True
while run:
    clock.tick(fps)
    screen.blit(bg_img, (-125, -110))
    world.draw()
    blob_group.update()
    blob_group.draw(screen)

    # Draw boss health bars
    for boss in blob_group:
        if isinstance(boss, KingEnemy):
            boss.draw_health_bar(screen)

    # --- NEW LOGIC: Trigger FinalTile after KingEnemy defeated ---
    all_kings_defeated = not any(isinstance(b, KingEnemy) and b.alive for b in blob_group)
    if all_kings_defeated:
        for tile in final_tile_group:
            tile.trigger_appearance()
    # -------------------------------------------------------------

    coin_group.draw(screen)
    lava_group.draw(screen)
    exit_group.draw(screen)
    final_tile_group.update()
    final_tile_group.draw(screen)

    if not game_over:
        player.update()
        screen.blit(player.image, player.rect)

        if pygame.sprite.spritecollide(player, coin_group, True):
            score += 1
        font = pygame.font.SysFont('Bauhaus 93', 35)
        score_text = font.render(f'Score: {score}/10', True, (255, 255, 0))
        screen.blit(score_text, (60, 150))

        # --- Boss and enemy collision handling ---
        for boss in blob_group:
            if isinstance(boss, KingEnemy) and boss.alive:
                if player.rect.colliderect(boss.rect):
                    if player.vel_y > 0 and player.rect.bottom - boss.rect.top < 30:
                        boss.take_damage()
                        player.vel_y = -12
                    elif boss.is_dashing or boss.vertical_velocity < 0:
                        game_over = True
                    else:
                        game_over = True

        # Regular enemy/lava collisions
        if pygame.sprite.spritecollideany(player, lava_group):
            game_over = True
        else:
            for enemy in blob_group:
                if not isinstance(enemy, KingEnemy) and player.rect.colliderect(enemy.rect):
                    game_over = True

        if pygame.sprite.spritecollideany(player, exit_group):
            total_score += score
            current_level += 1
            if current_level < len(levels):
                show_loading_screen(current_level)
                world, player = reset_level(current_level)
            else:
                show_win_screen(total_score)
                current_level = 0
                total_score = 0
                world, player = reset_level(current_level)

    else:
        overlay = pygame.Surface((screen_width, screen_height))
        overlay.set_alpha(200)
        overlay.fill((0, 0, 0))
        screen.blit(overlay, (0, 0))

        font = pygame.font.SysFont('Bauhaus 93', 80)
        text = font.render('GAME OVER', True, (255, 0, 0))
        text_rect = text.get_rect(center=(screen_width // 2, screen_height // 2 - 120))
        screen.blit(text, text_rect)

        button_font = pygame.font.SysFont('Press Start 2P', 40)
        restart_rect = pygame.Rect(screen_width // 2 - 250, screen_height // 2 - 20, 500, 80)
        menu_rect = pygame.Rect(screen_width // 2 - 250, screen_height // 2 + 80, 500, 80)
        mouse_pos = pygame.mouse.get_pos()

        restart_color = (0, 255, 0) if restart_rect.collidepoint(mouse_pos) else (0, 200, 0)
        menu_color = (255, 0, 0) if menu_rect.collidepoint(mouse_pos) else (200, 0, 0)
        pygame.draw.rect(screen, restart_color, restart_rect, border_radius=50)
        pygame.draw.rect(screen, menu_color, menu_rect, border_radius=50)

        restart_text = button_font.render('RESTART (R)', True, (0, 0, 0))
        menu_text = button_font.render('MAIN MENU (M)', True, (0, 0, 0))
        screen.blit(restart_text, restart_text.get_rect(center=restart_rect.center))
        screen.blit(menu_text, menu_text.get_rect(center=menu_rect.center))

        keys = pygame.key.get_pressed()
        if keys[pygame.K_r]:
            world, player = reset_level(current_level)
            game_over = False

        if keys[pygame.K_m]:
            fade_out_to_menu()
            main_menu()
            current_level = 0
            world, player = reset_level(current_level)
            game_over = False

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                run = False
                pygame.quit()
                sys.exit()

            elif event.type == pygame.MOUSEBUTTONDOWN:
                if restart_rect.collidepoint(event.pos):
                    world, player = reset_level(current_level)
                    game_over = False
                elif menu_rect.collidepoint(event.pos):
                    fade_out_to_menu()
                    main_menu()
                    current_level = 0
                    world, player = reset_level(current_level)
                    game_over = False

    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            run = False
            pygame.quit()
            sys.exit()

    pygame.display.update()
 