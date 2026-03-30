package com.loadsetu.vahansync.repository;

import com.loadsetu.vahansync.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    /** Login lookup — phone is the primary identity key. */
    Optional<User> findByPhone(String phone);

    boolean existsByPhone(String phone);
}
